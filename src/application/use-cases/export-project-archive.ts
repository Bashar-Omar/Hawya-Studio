import type { BinaryStore } from "@/application/ports/binary-store";
import type { ProjectArchiveCodec } from "@/application/ports/project-archive-codec";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { ExportProjectSnapshotArchiveUseCase } from "@/application/use-cases/export-project-snapshot-archive";
import { ProjectArchiveError } from "@/domain/project/errors";
import type { ProjectId } from "@/domain/project/hawya-project";
import { err, type Result } from "@/shared/types/result";

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

    return new ExportProjectSnapshotArchiveUseCase(this.binaries, this.codec).execute(snapshot);
  }
}
