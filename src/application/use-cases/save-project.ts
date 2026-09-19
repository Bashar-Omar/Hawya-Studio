import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { type ProjectSnapshot, projectSnapshotSchema } from "@/domain/project/hawya-project";

export class SaveProjectUseCase {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ProjectSnapshot): Promise<ProjectSnapshot> {
    const snapshot = projectSnapshotSchema.parse(input);
    const savedSnapshot = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: {
          ...snapshot.project.metadata,
          updatedAt: this.clock.now(),
        },
      },
    });

    await this.repository.save(savedSnapshot);
    return savedSnapshot;
  }
}
