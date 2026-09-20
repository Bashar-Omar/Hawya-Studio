import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AssetId } from "@/domain/assets/asset";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

export class UpdateAssetTagsUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(projectId: ProjectId, assetId: AssetId, tags: string[]): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    if (!snapshot.assets.some((asset) => asset.id === assetId))
      throw new Error(`Asset ${assetId} does not exist`);
    const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 24);
    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: { ...snapshot.project, metadata: { ...snapshot.project.metadata, updatedAt: now } },
      assets: snapshot.assets.map((asset) =>
        asset.id === assetId ? { ...asset, tags: normalized, updatedAt: now } : asset,
      ),
    });
    await this.projects.save(next);
    return next;
  }
}
