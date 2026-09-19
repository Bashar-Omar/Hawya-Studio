import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { ProjectId } from "@/domain/project/hawya-project";
import { projectSnapshotSchema } from "@/domain/project/hawya-project";
import type { ExportProjectArchiveUseCase } from "@/application/use-cases/export-project-archive";

export class ExportProjectBackupUseCase {
  constructor(
    private readonly exporter: ExportProjectArchiveUseCase,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(projectId: ProjectId) {
    const result = await this.exporter.execute(projectId);
    if (!result.ok) {
      return result;
    }

    const snapshot = await this.projects.get(projectId);
    if (snapshot) {
      const timestamp = this.clock.now();
      await this.projects.save(
        projectSnapshotSchema.parse({
          ...snapshot,
          project: {
            ...snapshot.project,
            metadata: {
              ...snapshot.project.metadata,
              lastBackupAt: timestamp,
              lastExportAt: timestamp,
            },
          },
        }),
      );
    }
    return result;
  }
}
