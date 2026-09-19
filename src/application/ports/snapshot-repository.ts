import type { ProjectId } from "@/domain/project/hawya-project";
import type { StoredProjectSnapshot } from "@/domain/project/snapshot";

export interface SnapshotRepository {
  put(snapshot: StoredProjectSnapshot): Promise<void>;
  list(projectId: ProjectId): Promise<StoredProjectSnapshot[]>;
  delete(projectId: ProjectId, createdAt: string): Promise<void>;
}
