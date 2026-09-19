import type { ProjectId, ProjectMetadata, ProjectSnapshot } from "@/domain/project/hawya-project";

export interface ProjectRepository {
  save(snapshot: ProjectSnapshot): Promise<void>;
  get(projectId: ProjectId): Promise<ProjectSnapshot | undefined>;
  listMetadata(): Promise<ProjectMetadata[]>;
  delete(projectId: ProjectId): Promise<void>;
}
