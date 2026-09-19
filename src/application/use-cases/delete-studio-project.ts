import type { SetupDraftRepository } from "@/application/ports/setup-draft-repository";
import type { ProjectId } from "@/domain/project/hawya-project";
import type { DeleteProjectUseCase } from "@/application/use-cases/delete-project";

export class DeleteStudioProjectUseCase {
  constructor(
    private readonly deleteProject: DeleteProjectUseCase,
    private readonly setupDrafts: SetupDraftRepository,
  ) {}

  async execute(projectId: ProjectId): Promise<void> {
    await this.deleteProject.execute(projectId);
    await this.setupDrafts.delete(projectId);
  }
}
