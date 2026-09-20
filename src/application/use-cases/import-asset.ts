import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AssetIngestor, AssetSource } from "@/application/services/asset-ingestor";
import { type Asset, assetSchema } from "@/domain/assets/asset";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

function displayName(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || filename;
}

export class ImportAssetUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly ingestor: AssetIngestor,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    projectId: ProjectId,
    source: AssetSource,
  ): Promise<{ snapshot: ProjectSnapshot; asset: Asset }> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);

    const prepared = await this.ingestor.prepare(source);
    const now = this.clock.now();
    const kind = source.intendedKind ?? prepared.detectedKind;
    const asset = assetSchema.parse({
      id: this.ids.newId(),
      projectId,
      contentHash: prepared.contentHash,
      kind,
      name: displayName(source.filename),
      originalFilename: source.filename,
      mime: prepared.mime,
      extension: prepared.extension,
      byteLength: prepared.byteLength,
      createdAt: now,
      updatedAt: now,
      tags: [],
      metadata: prepared.metadata,
      binaryKey: prepared.contentHash,
      ...(prepared.previewBinaryKey ? { previewBinaryKey: prepared.previewBinaryKey } : {}),
      security: prepared.security,
    });
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: now },
        assetRefs: [...snapshot.project.assetRefs, { assetId: asset.id }],
      },
      assets: [...snapshot.assets, asset],
    });
    await this.projects.save(next);
    return { snapshot: next, asset };
  }
}
