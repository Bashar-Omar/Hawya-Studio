import type { BinaryStore } from "@/application/ports/binary-store";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectArchiveCodec } from "@/application/ports/project-archive-codec";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { StorageError, type ProjectArchiveError } from "@/domain/project/errors";
import { type ProjectSnapshot, rebaseProjectSnapshotId } from "@/domain/project/hawya-project";
import { err, ok, type Result } from "@/shared/types/result";

export type ImportProjectArchiveError = ProjectArchiveError | StorageError;

export class ImportProjectArchiveUseCase {
  constructor(
    private readonly codec: ProjectArchiveCodec,
    private readonly projects: ProjectRepository,
    private readonly binaries: BinaryStore,
    private readonly ids: IdGenerator,
  ) {}

  async execute(bytes: Uint8Array): Promise<Result<ProjectSnapshot, ImportProjectArchiveError>> {
    const decoded = await this.codec.decode(bytes);
    if (!decoded.ok) {
      return decoded;
    }

    const rebased = rebaseProjectSnapshotId(decoded.value.snapshot, this.ids.newId());
    try {
      for (const binary of decoded.value.binaries) {
        await this.binaries.put(binary);
      }
      await this.projects.save(rebased);
      return ok(rebased);
    } catch (error) {
      return err(
        error instanceof StorageError
          ? error
          : new StorageError(
              "transaction-failed",
              "Imported project could not be persisted",
              error,
            ),
      );
    }
  }
}
