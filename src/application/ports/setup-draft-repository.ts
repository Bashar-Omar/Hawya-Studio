import type { ProjectId } from "@/domain/project/hawya-project";
import type { ProjectSetupDraft } from "@/domain/project/setup-draft";

export interface SetupDraftRepository {
  get(projectId: ProjectId): Promise<ProjectSetupDraft | undefined>;
  list(): Promise<ProjectSetupDraft[]>;
  save(draft: ProjectSetupDraft): Promise<void>;
  delete(projectId: ProjectId): Promise<void>;
}
