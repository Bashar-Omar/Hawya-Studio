import type { BinaryStore } from "@/application/ports/binary-store";
import type { ProjectArchiveCodec } from "@/application/ports/project-archive-codec";
import { ProjectArchiveError } from "@/domain/project/errors";
import { type ProjectSnapshot, projectSnapshotSchema } from "@/domain/project/hawya-project";
import { err, type Result } from "@/shared/types/result";

export class ExportProjectSnapshotArchiveUseCase {
  constructor(
    private readonly binaries: BinaryStore,
    private readonly codec: ProjectArchiveCodec,
  ) {}

  async execute(input: ProjectSnapshot): Promise<Result<Uint8Array, ProjectArchiveError>> {
    let snapshot: ProjectSnapshot;
    try {
      snapshot = projectSnapshotSchema.parse(input);
    } catch (error) {
      return err(
        new ProjectArchiveError(
          "invalid-project",
          "In-memory project snapshot is not valid for backup",
          error,
        ),
      );
    }

    const referencedIds = new Set(snapshot.project.assetRefs.map((reference) => reference.assetId));
    const hashes = [
      ...new Set(
        snapshot.assets
          .filter((asset) => referencedIds.has(asset.id))
          .map((asset) => asset.contentHash),
      ),
    ].sort();

    const payloads = [];
    for (const hash of hashes) {
      const binary = await this.binaries.get(hash);
      if (!binary) {
        return err(
          new ProjectArchiveError(
            "missing-binary",
            `Project references binary ${hash} but it is missing from local storage`,
          ),
        );
      }
      payloads.push(binary);
    }

    return this.codec.encode({ snapshot, binaries: payloads });
  }
}
