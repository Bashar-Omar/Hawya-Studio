import type { ProjectRepository } from "@/application/ports/project-repository";
import { countAssetReferences, countColorTokenReferences } from "@/domain/brand/brand-references";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";

export interface BrandSystemView {
  snapshot: ProjectSnapshot;
  assetUsage: Record<string, number>;
  colorUsage: Record<string, number>;
}

export class BrandSystemQuery {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(projectId: ProjectId): Promise<BrandSystemView | undefined> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) return undefined;
    return {
      snapshot,
      assetUsage: Object.fromEntries(
        snapshot.assets.map((asset) => [
          asset.id,
          Math.max(0, countAssetReferences(snapshot, asset.id) - 1),
        ]),
      ),
      colorUsage: Object.fromEntries(
        snapshot.project.brand.colors.tokens.map((token) => [
          token.id,
          countColorTokenReferences(snapshot, token.id),
        ]),
      ),
    };
  }
}
