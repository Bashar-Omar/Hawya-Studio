import type { ProjectRepository } from "@/application/ports/project-repository";
import type { SetupDraftRepository } from "@/application/ports/setup-draft-repository";
import type { ProjectId, ProjectMetadata } from "@/domain/project/hawya-project";
import type { ProjectSetupDraft } from "@/domain/project/setup-draft";

export interface ProjectLibraryItem {
  id: ProjectId;
  metadata: ProjectMetadata;
  setupDraft?: ProjectSetupDraft;
  backupRecommended: boolean;
}

export class ProjectLibraryQuery {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly setupDrafts: SetupDraftRepository,
  ) {}

  async execute(): Promise<ProjectLibraryItem[]> {
    const [projects, drafts] = await Promise.all([
      this.projects.listMetadata(),
      this.setupDrafts.list(),
    ]);
    const draftByProject = new Map(drafts.map((draft) => [draft.projectId, draft]));
    return projects
      .map(({ id, metadata }) => {
        const setupDraft = draftByProject.get(id);
        return {
          id,
          metadata,
          ...(setupDraft ? { setupDraft } : {}),
          backupRecommended: !metadata.lastBackupAt || metadata.updatedAt > metadata.lastBackupAt,
        };
      })
      .sort((left, right) => {
        const leftActivity = left.metadata.lastOpenedAt ?? left.metadata.updatedAt;
        const rightActivity = right.metadata.lastOpenedAt ?? right.metadata.updatedAt;
        return rightActivity.localeCompare(leftActivity);
      });
  }
}
