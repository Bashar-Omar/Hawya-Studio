import type { ProjectId, ProjectMetadata, ProjectSnapshot } from "@/domain/project/hawya-project";

export interface ProjectListItem {
  id: ProjectId;
  metadata: ProjectMetadata;
}

export interface ProjectRepository {
  save(snapshot: ProjectSnapshot): Promise<void>;
  get(projectId: ProjectId): Promise<ProjectSnapshot | undefined>;
  listMetadata(): Promise<ProjectListItem[]>;
  delete(projectId: ProjectId): Promise<void>;
}
