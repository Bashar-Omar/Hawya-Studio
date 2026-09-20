import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AssetId } from "@/domain/assets/asset";
import { type LogoVariant, logoVariantSchema } from "@/domain/brand/brand-system";
import type { LocalizedString } from "@/domain/common/primitives";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

export interface LogoVariantInput {
  name: LocalizedString;
  role: LogoVariant["role"];
  assetId: AssetId;
  preferredBackground?: string;
  usage?: LocalizedString;
}

export class ManageLogoVariantsUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async add(projectId: ProjectId, input: LogoVariantInput): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    this.requireAsset(snapshot, input.assetId);
    const variant = logoVariantSchema.parse({ id: this.ids.newId(), ...input });
    const primaryLogoId = snapshot.project.brand.logos.primaryLogoId ?? variant.id;
    return this.save(snapshot, {
      ...snapshot.project.brand.logos,
      variants: [...snapshot.project.brand.logos.variants, variant],
      primaryLogoId,
    });
  }

  async update(
    projectId: ProjectId,
    variantId: string,
    input: LogoVariantInput,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    this.requireAsset(snapshot, input.assetId);
    if (!snapshot.project.brand.logos.variants.some((variant) => variant.id === variantId)) {
      throw new Error("Logo variant does not exist");
    }
    const variant = logoVariantSchema.parse({ id: variantId, ...input });
    return this.save(snapshot, {
      ...snapshot.project.brand.logos,
      variants: snapshot.project.brand.logos.variants.map((item) =>
        item.id === variantId ? variant : item,
      ),
    });
  }

  async setPrimary(projectId: ProjectId, variantId: string): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    if (!snapshot.project.brand.logos.variants.some((variant) => variant.id === variantId)) {
      throw new Error("Logo variant does not exist");
    }
    return this.save(snapshot, { ...snapshot.project.brand.logos, primaryLogoId: variantId });
  }

  async remove(projectId: ProjectId, variantId: string): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    const variants = snapshot.project.brand.logos.variants.filter(
      (variant) => variant.id !== variantId,
    );
    const primaryLogoId =
      snapshot.project.brand.logos.primaryLogoId === variantId
        ? variants[0]?.id
        : snapshot.project.brand.logos.primaryLogoId;
    const logos = {
      ...snapshot.project.brand.logos,
      variants,
      ...(primaryLogoId ? { primaryLogoId } : {}),
    };
    if (!primaryLogoId) delete (logos as { primaryLogoId?: string }).primaryLogoId;
    return this.save(snapshot, logos);
  }

  private async requireProject(projectId: ProjectId): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    return snapshot;
  }

  private requireAsset(snapshot: ProjectSnapshot, assetId: AssetId): void {
    if (!snapshot.assets.some((asset) => asset.id === assetId)) {
      throw new Error("Logo asset does not exist in this project");
    }
  }

  private async save(
    snapshot: ProjectSnapshot,
    logos: ProjectSnapshot["project"]["brand"]["logos"],
  ): Promise<ProjectSnapshot> {
    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: now },
        brand: { ...snapshot.project.brand, logos },
      },
    });
    await this.projects.save(next);
    return next;
  }
}
