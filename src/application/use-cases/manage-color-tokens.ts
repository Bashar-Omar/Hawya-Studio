import type { Clock } from "@/application/ports/clock";
import type { ColorEngine } from "@/application/ports/color-engine";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { countColorTokenReferences } from "@/domain/brand/brand-references";
import { type ColorToken, colorTokenSchema } from "@/domain/brand/brand-system";
import type { LocalizedString } from "@/domain/common/primitives";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

export interface ColorTokenInput {
  name: LocalizedString;
  role: ColorToken["role"];
  srgbHex: string;
  alpha?: number;
  verifiedCmyk?: { c: number; m: number; y: number; k: number };
  pantoneName?: string;
  usage?: LocalizedString;
}

function normalizeHex(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) throw new Error("Color must be a six-digit HEX value");
  return normalized;
}

export class ManageColorTokensUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly colors: ColorEngine,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async add(projectId: ProjectId, input: ColorTokenInput): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    const token = await this.buildToken(this.ids.newId(), input);
    return this.save(snapshot, [...snapshot.project.brand.colors.tokens, token]);
  }

  async update(
    projectId: ProjectId,
    tokenId: string,
    input: ColorTokenInput,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    const existing = snapshot.project.brand.colors.tokens.find((token) => token.id === tokenId);
    if (!existing) throw new Error("Color token does not exist");
    const token = await this.buildToken(tokenId, input, existing);
    return this.save(
      snapshot,
      snapshot.project.brand.colors.tokens.map((item) => (item.id === tokenId ? token : item)),
    );
  }

  async remove(projectId: ProjectId, tokenId: string): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    if (countColorTokenReferences(snapshot, tokenId) > 0) {
      throw new Error("Color token is still referenced by the brand system or guide");
    }
    return this.save(
      snapshot,
      snapshot.project.brand.colors.tokens.filter((token) => token.id !== tokenId),
    );
  }

  async contrast(
    projectId: ProjectId,
    foregroundId: string,
    backgroundId: string,
  ): Promise<number> {
    const snapshot = await this.requireProject(projectId);
    const foreground = snapshot.project.brand.colors.tokens.find(
      (token) => token.id === foregroundId,
    );
    const background = snapshot.project.brand.colors.tokens.find(
      (token) => token.id === backgroundId,
    );
    if (!foreground || !background) throw new Error("Contrast tokens are missing");
    return this.colors.contrast(foreground.srgbHex, background.srgbHex);
  }

  private async buildToken(
    id: string,
    input: ColorTokenInput,
    existing?: ColorToken,
  ): Promise<ColorToken> {
    const srgbHex = normalizeHex(input.srgbHex);
    const derived = await this.colors.derive(srgbHex);
    const screenChanged = existing ? existing.srgbHex.toUpperCase() !== srgbHex : false;
    const verifiedCmyk = input.verifiedCmyk ?? existing?.print?.verifiedCmyk;
    const verifiedCmykNeedsReview = Boolean(
      verifiedCmyk && screenChanged && input.verifiedCmyk === undefined,
    );
    const print = {
      suggestedCmyk: derived.suggestedCmyk,
      ...(verifiedCmyk ? { verifiedCmyk } : {}),
      ...(verifiedCmyk ? { verifiedCmykNeedsReview } : {}),
      ...(input.pantoneName?.trim() ? { pantoneName: input.pantoneName.trim() } : {}),
      ...(existing?.print?.note ? { note: existing.print.note } : {}),
    };
    return colorTokenSchema.parse({
      id,
      name: input.name,
      role: input.role,
      srgbHex,
      alpha: input.alpha ?? existing?.alpha ?? 1,
      rgb: derived.rgb,
      hsl: derived.hsl,
      oklch: derived.oklch,
      print,
      ...(input.usage ? { usage: input.usage } : existing?.usage ? { usage: existing.usage } : {}),
    });
  }

  private async requireProject(projectId: ProjectId): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    return snapshot;
  }

  private async save(snapshot: ProjectSnapshot, tokens: ColorToken[]): Promise<ProjectSnapshot> {
    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: now },
        brand: { ...snapshot.project.brand, colors: { tokens } },
      },
    });
    await this.projects.save(next);
    return next;
  }
}
