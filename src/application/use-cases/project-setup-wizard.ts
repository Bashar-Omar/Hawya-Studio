import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { SetupDraftRepository } from "@/application/ports/setup-draft-repository";
import type { ContentLocale, LocalizedString } from "@/domain/common/primitives";
import {
  projectSnapshotSchema,
  type ProjectId,
  type ProjectSnapshot,
} from "@/domain/project/hawya-project";
import {
  nextSetupStep,
  projectSetupDraftSchema,
  type ProjectSetupDraft,
  type SetupStep,
  type SetupStepStatus,
} from "@/domain/project/setup-draft";

export interface SetupWizardState {
  snapshot: ProjectSnapshot;
  draft: ProjectSetupDraft;
}

export interface FoundationInput {
  descriptor?: string;
  mission?: string;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function localizedValue(locale: ContentLocale, value: string): LocalizedString {
  return locale === "ar" ? { ar: value } : { en: value };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export class ProjectSetupWizardUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly setupDrafts: SetupDraftRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async load(projectId: ProjectId): Promise<SetupWizardState | undefined> {
    const [snapshot, draft] = await Promise.all([
      this.projects.get(projectId),
      this.setupDrafts.get(projectId),
    ]);
    if (!snapshot || !draft) {
      return undefined;
    }
    return { snapshot, draft };
  }

  async setCurrentStep(projectId: ProjectId, step: SetupStep): Promise<ProjectSetupDraft> {
    const draft = await this.requireDraft(projectId);
    const updated = projectSetupDraftSchema.parse({
      ...draft,
      currentStep: step,
      updatedAt: this.clock.now(),
    });
    await this.setupDrafts.save(updated);
    return updated;
  }

  async skip(projectId: ProjectId, step: SetupStep): Promise<ProjectSetupDraft> {
    if (step === "basic" || step === "guide") {
      throw new Error(`${step} cannot be skipped`);
    }
    return this.finishStep(projectId, step, "skipped");
  }

  async completeLogo(projectId: ProjectId): Promise<ProjectSetupDraft> {
    return this.finishStep(projectId, "logo", "completed");
  }

  async completeTypography(projectId: ProjectId): Promise<ProjectSetupDraft> {
    return this.finishStep(projectId, "typography", "completed");
  }

  async completeColors(projectId: ProjectId, primaryHex?: string): Promise<ProjectSetupDraft> {
    const value = primaryHex?.trim();
    if (!value) {
      return this.skip(projectId, "colors");
    }
    if (!HEX_COLOR.test(value)) {
      throw new Error("Primary color must be a six-digit HEX value");
    }

    const snapshot = await this.requireProject(projectId);
    const locale = snapshot.project.settings.defaultContentLocale;
    const normalizedHex = value.toUpperCase();
    const existingPrimary = snapshot.project.brand.colors.tokens.find(
      (token) => token.role === "primary",
    );
    const primaryToken = {
      id: existingPrimary?.id ?? this.ids.newId(),
      name: localizedValue(locale, locale === "ar" ? "اللون الأساسي" : "Primary"),
      role: "primary" as const,
      srgbHex: normalizedHex,
      alpha: 1,
      rgb: hexToRgb(normalizedHex),
    };
    const tokens = existingPrimary
      ? snapshot.project.brand.colors.tokens.map((token) =>
          token.id === existingPrimary.id ? primaryToken : token,
        )
      : [primaryToken, ...snapshot.project.brand.colors.tokens];

    await this.projects.save(
      projectSnapshotSchema.parse({
        ...snapshot,
        project: {
          ...snapshot.project,
          metadata: { ...snapshot.project.metadata, updatedAt: this.clock.now() },
          brand: {
            ...snapshot.project.brand,
            colors: { tokens },
          },
        },
      }),
    );
    return this.finishStep(projectId, "colors", "completed");
  }

  async completeFoundation(
    projectId: ProjectId,
    input: FoundationInput,
  ): Promise<ProjectSetupDraft> {
    const descriptor = input.descriptor?.trim();
    const mission = input.mission?.trim();
    if (!descriptor && !mission) {
      return this.skip(projectId, "foundation");
    }

    const snapshot = await this.requireProject(projectId);
    const locale = snapshot.project.settings.defaultContentLocale;
    await this.projects.save(
      projectSnapshotSchema.parse({
        ...snapshot,
        project: {
          ...snapshot.project,
          metadata: { ...snapshot.project.metadata, updatedAt: this.clock.now() },
          brand: {
            ...snapshot.project.brand,
            identity: {
              ...snapshot.project.brand.identity,
              ...(descriptor ? { descriptor: localizedValue(locale, descriptor) } : {}),
              ...(mission ? { mission: localizedValue(locale, mission) } : {}),
            },
          },
        },
      }),
    );
    return this.finishStep(projectId, "foundation", "completed");
  }

  async finish(
    projectId: ProjectId,
    guideProfile: "minimal" | "standard" | "comprehensive",
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    const now = this.clock.now();
    const completed = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: {
          ...snapshot.project.metadata,
          updatedAt: now,
          lastOpenedAt: now,
        },
        settings: {
          ...snapshot.project.settings,
          guideProfile,
        },
      },
    });
    await this.projects.save(completed);
    const draft = await this.requireDraft(projectId);
    await this.setupDrafts.save(
      projectSetupDraftSchema.parse({
        ...draft,
        currentStep: "guide",
        steps: { ...draft.steps, guide: "completed" },
        updatedAt: now,
      }),
    );
    await this.setupDrafts.delete(projectId);
    return completed;
  }

  private async finishStep(
    projectId: ProjectId,
    step: SetupStep,
    status: Extract<SetupStepStatus, "completed" | "skipped">,
  ): Promise<ProjectSetupDraft> {
    const draft = await this.requireDraft(projectId);
    const next = nextSetupStep(step) ?? step;
    const updated = projectSetupDraftSchema.parse({
      ...draft,
      currentStep: next,
      steps: { ...draft.steps, [step]: status },
      updatedAt: this.clock.now(),
    });
    await this.setupDrafts.save(updated);
    return updated;
  }

  private async requireProject(projectId: ProjectId): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) {
      throw new Error(`Project ${projectId} does not exist`);
    }
    return snapshot;
  }

  private async requireDraft(projectId: ProjectId): Promise<ProjectSetupDraft> {
    const draft = await this.setupDrafts.get(projectId);
    if (!draft) {
      throw new Error(`Setup draft for ${projectId} does not exist`);
    }
    return draft;
  }
}
