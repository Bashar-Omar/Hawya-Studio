import type { BinaryStore } from "@/application/ports/binary-store";
import type { ProjectArchiveCodec } from "@/application/ports/project-archive-codec";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { ProjectArchiveError } from "@/domain/project/errors";
import type { ProjectId } from "@/domain/project/hawya-project";
import { err, ok, type Result } from "@/shared/types/result";

export class ExportProjectArchiveUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly binaries: BinaryStore,
    private readonly codec: ProjectArchiveCodec,
  ) {}

  async execute(projectId: ProjectId): Promise<Result<Uint8Array, ProjectArchiveError>> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) {
      return err(new ProjectArchiveError("invalid-project", `Project ${projectId} does not exist`));
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

    const result = await this.codec.encode({ snapshot, binaries: payloads });
    return result.ok ? ok(result.value) : result;
  }
}
