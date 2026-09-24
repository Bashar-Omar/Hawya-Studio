import type { ProjectRepository } from "@/application/ports/project-repository";
import {
  countAssetReferencesById,
  countColorTokenReferencesById,
} from "@/domain/brand/brand-references";
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
    const assetReferences = countAssetReferencesById(snapshot);
    const colorReferences = countColorTokenReferencesById(snapshot);
    return {
      snapshot,
      assetUsage: Object.fromEntries(
        snapshot.assets.map((asset) => [
          asset.id,
          Math.max(0, (assetReferences.get(asset.id) ?? 0) - 1),
        ]),
      ),
      colorUsage: Object.fromEntries(
        snapshot.project.brand.colors.tokens.map((token) => [
          token.id,
          colorReferences.get(token.id) ?? 0,
        ]),
      ),
    };
  }
}
