import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { SetupDraftRepository } from "@/application/ports/setup-draft-repository";
import type { ContentLocale } from "@/domain/common/primitives";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/domain/project/schema-version";
import { type ProjectSnapshot, projectSnapshotSchema } from "@/domain/project/hawya-project";
import { createProjectSetupDraft } from "@/domain/project/setup-draft";

export interface CreateProjectInput {
  name: string;
  clientName?: string;
  designerName?: string;
  defaultContentLocale: ContentLocale;
  enabledContentLocales: ContentLocale[];
}

export function slugifyProjectName(name: string, fallbackId: string): string {
  const slug = name
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `project-${fallbackId.slice(0, 8)}`;
}

export class CreateProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly setupDrafts: SetupDraftRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateProjectInput): Promise<ProjectSnapshot> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Project name is required");
    }

    const projectId = this.ids.newId();
    const now = this.clock.now();
    const enabledContentLocales = [...new Set(input.enabledContentLocales)];
    if (!enabledContentLocales.includes(input.defaultContentLocale)) {
      enabledContentLocales.unshift(input.defaultContentLocale);
    }

    const brandName = input.defaultContentLocale === "ar" ? { ar: name } : { en: name };

    const snapshot = projectSnapshotSchema.parse({
      project: {
        schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
        id: projectId,
        metadata: {
          name,
          slug: slugifyProjectName(name, projectId),
          ...(input.clientName?.trim() ? { clientName: input.clientName.trim() } : {}),
          ...(input.designerName?.trim() ? { designerName: input.designerName.trim() } : {}),
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          tags: [],
        },
        settings: {
          defaultContentLocale: input.defaultContentLocale,
          enabledContentLocales,
          defaultDirection: input.defaultContentLocale === "ar" ? "rtl" : "ltr",
          guideProfile: "standard",
          pagePreset: "screen-16-9",
          templateFamilyId: "essential",
          unitDisplay: "px",
          snapEnabled: true,
          autosaveEnabled: true,
        },
        brand: {
          identity: {
            brandName,
            values: [],
            personality: [],
          },
          logos: {
            variants: [],
            rules: { incorrectUsage: [] },
          },
          colors: { tokens: [] },
          typography: { fonts: [], styles: [] },
          visualLanguage: {},
        },
        guide: { sections: [], pageOrder: [], pages: {} },
        assetRefs: [],
        templatePackRefs: [],
        revisions: [],
      },
      assets: [],
    });

    await this.projects.save(snapshot);
    await this.setupDrafts.save(createProjectSetupDraft(projectId, now));
    return snapshot;
  }
}
