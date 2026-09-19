import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import { projectSnapshotSchema } from "@/domain/project/hawya-project";

export class OpenProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(projectId: ProjectId): Promise<ProjectSnapshot | undefined> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) {
      return undefined;
    }
    const opened = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: {
          ...snapshot.project.metadata,
          lastOpenedAt: this.clock.now(),
        },
      },
    });
    await this.projects.save(opened);
    return opened;
  }
}
