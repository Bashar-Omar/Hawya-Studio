import type { BinaryStore } from "@/application/ports/binary-store";
import type { ProjectArchiveCodec } from "@/application/ports/project-archive-codec";
import type { ExportArtifact, ExportRenderer } from "@/domain/export/export-contract";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import { slugifyFilename } from "@/infrastructure/export/export-helpers";

export type ProjectArchiveExportOptions = Record<string, never>;

export class ProjectArchiveExportRenderer implements ExportRenderer<ProjectArchiveExportOptions> {
  readonly format = "hawya" as const;

  constructor(
    private readonly binaries: BinaryStore,
    private readonly codec: ProjectArchiveCodec,
  ) {}

  async render(
    snapshot: ProjectSnapshot,
    _options: ProjectArchiveExportOptions,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]> {
    const referenced = new Set(snapshot.project.assetRefs.map((reference) => reference.assetId));
    const hashes = [
      ...new Set(
        snapshot.assets
          .filter((asset) => referenced.has(asset.id))
          .map((asset) => asset.contentHash),
      ),
    ].sort();

    const payloads = [];
    for (const hash of hashes) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const binary = await this.binaries.get(hash);
      if (!binary) throw new Error(`Project binary ${hash} is unavailable`);
      payloads.push(binary);
    }

    const encoded = await this.codec.encode({ snapshot, binaries: payloads });
    if (!encoded.ok) throw encoded.error;

    return [
      {
        filename: `${slugifyFilename(snapshot.project.metadata.name)}.hawya`,
        mime: "application/zip",
        bytes: encoded.value,
      },
    ];
  }
}
