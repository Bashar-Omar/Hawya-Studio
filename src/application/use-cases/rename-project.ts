import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import { projectSnapshotSchema } from "@/domain/project/hawya-project";
import { slugifyProjectName } from "@/application/use-cases/create-project";

export class RenameProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(projectId: ProjectId, nextName: string): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) {
      throw new Error(`Project ${projectId} does not exist`);
    }
    const name = nextName.trim();
    if (!name) {
      throw new Error("Project name is required");
    }

    const updated = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: {
          ...snapshot.project.metadata,
          name,
          slug: slugifyProjectName(name, projectId),
          updatedAt: this.clock.now(),
        },
      },
    });
    await this.projects.save(updated);
    return updated;
  }
}
