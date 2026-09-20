import type { GarbageCollectBinariesUseCase } from "@/application/use-cases/garbage-collect-binaries";
import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AssetId } from "@/domain/assets/asset";
import { countAssetReferences } from "@/domain/brand/brand-references";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

export class DeleteAssetUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly garbageCollector: GarbageCollectBinariesUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(projectId: ProjectId, assetId: AssetId): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    const references = countAssetReferences(snapshot, assetId);
    // One reference is the top-level assetRefs ownership entry itself.
    if (references > 1) {
      throw new Error("Asset is still used by the brand system or guide");
    }
    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: now },
        assetRefs: snapshot.project.assetRefs.filter((reference) => reference.assetId !== assetId),
      },
      assets: snapshot.assets.filter((asset) => asset.id !== assetId),
    });
    await this.projects.save(next);
    await this.garbageCollector.execute();
    return next;
  }
}
