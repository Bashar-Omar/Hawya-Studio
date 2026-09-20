import type { GarbageCollectBinariesUseCase } from "@/application/use-cases/garbage-collect-binaries";
import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AssetIngestor, AssetSource } from "@/application/services/asset-ingestor";
import type { AssetId } from "@/domain/assets/asset";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

export class ReplaceAssetUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly ingestor: AssetIngestor,
    private readonly garbageCollector: GarbageCollectBinariesUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(
    projectId: ProjectId,
    assetId: AssetId,
    source: AssetSource,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    const existing = snapshot.assets.find((asset) => asset.id === assetId);
    if (!existing) throw new Error(`Asset ${assetId} does not exist`);

    const prepared = await this.ingestor.prepare({
      ...source,
      intendedKind:
        source.intendedKind ??
        (existing.kind === "logo"
          ? "logo"
          : existing.kind === "font"
            ? "font"
            : existing.kind === "vector"
              ? "vector"
              : "image"),
    });
    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: now },
      },
      assets: snapshot.assets.map((asset) => {
        if (asset.id !== assetId) return asset;
        const { previewBinaryKey: _previousPreview, ...withoutPreview } = asset;
        return {
          ...withoutPreview,
          contentHash: prepared.contentHash,
          binaryKey: prepared.contentHash,
          originalFilename: source.filename,
          mime: prepared.mime,
          extension: prepared.extension,
          byteLength: prepared.byteLength,
          updatedAt: now,
          metadata: prepared.metadata,
          security: prepared.security,
          ...(prepared.previewBinaryKey ? { previewBinaryKey: prepared.previewBinaryKey } : {}),
        };
      }),
    });
    await this.projects.save(next);
    await this.garbageCollector.execute();
    return next;
  }
}
