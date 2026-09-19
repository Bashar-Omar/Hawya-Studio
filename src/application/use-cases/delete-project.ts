import type { ProjectRepository } from "@/application/ports/project-repository";
import type { ProjectId } from "@/domain/project/hawya-project";
import type { GarbageCollectBinariesUseCase } from "@/application/use-cases/garbage-collect-binaries";

export class DeleteProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly garbageCollector: GarbageCollectBinariesUseCase,
  ) {}

  async execute(projectId: ProjectId): Promise<void> {
    await this.projects.delete(projectId);
    await this.garbageCollector.execute();
  }
}
