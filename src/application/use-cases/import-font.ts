import type { BinaryStore } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type { FontRegistry } from "@/application/ports/font-registry";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AssetSource } from "@/application/services/asset-ingestor";
import type { ImportAssetUseCase } from "@/application/use-cases/import-asset";
import { fontAssetMetadataSchema } from "@/domain/assets/asset-metadata";
import { type FontAssetRef, fontAssetRefSchema } from "@/domain/brand/brand-system";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

export class ImportFontUseCase {
  constructor(
    private readonly importAsset: ImportAssetUseCase,
    private readonly projects: ProjectRepository,
    private readonly binaries: BinaryStore,
    private readonly registry: FontRegistry,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    projectId: ProjectId,
    source: AssetSource,
    licenseNote?: string,
  ): Promise<{ snapshot: ProjectSnapshot; font: FontAssetRef }> {
    const imported = await this.importAsset.execute(projectId, { ...source, intendedKind: "font" });
    const metadata = fontAssetMetadataSchema.parse(imported.asset.metadata);
    const font = fontAssetRefSchema.parse({
      id: this.ids.newId(),
      assetId: imported.asset.id,
      familyName: metadata.familyName,
      ...(metadata.subfamilyName ? { subfamilyName: metadata.subfamilyName } : {}),
      ...(metadata.postscriptName ? { postscriptName: metadata.postscriptName } : {}),
      ...(metadata.weight ? { weight: metadata.weight } : {}),
      ...(metadata.style ? { style: metadata.style } : {}),
      ...(metadata.variableAxes ? { variableAxes: metadata.variableAxes } : {}),
      coverage: metadata.coverage,
      ...(licenseNote?.trim() ? { licenseNote: licenseNote.trim() } : {}),
    });
    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...imported.snapshot,
      project: {
        ...imported.snapshot.project,
        metadata: { ...imported.snapshot.project.metadata, updatedAt: now },
        brand: {
          ...imported.snapshot.project.brand,
          typography: {
            ...imported.snapshot.project.brand.typography,
            fonts: [...imported.snapshot.project.brand.typography.fonts, font],
          },
        },
      },
    });
    await this.projects.save(next);
    const binary = await this.binaries.get(imported.asset.contentHash);
    if (!binary) throw new Error("Imported font binary is missing after persistence");
    await this.registry.register(font, binary.bytes);
    return { snapshot: next, font };
  }
}
