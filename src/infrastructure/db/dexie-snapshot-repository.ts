import type { SnapshotRepository } from "@/application/ports/snapshot-repository";
import { StorageError } from "@/domain/project/errors";
import type { ProjectId } from "@/domain/project/hawya-project";
import { type StoredProjectSnapshot, storedProjectSnapshotSchema } from "@/domain/project/snapshot";
import type { HawyaDatabase } from "@/infrastructure/db/hawya-database";

export class DexieSnapshotRepository implements SnapshotRepository {
  constructor(private readonly db: HawyaDatabase) {}

  async put(input: StoredProjectSnapshot): Promise<void> {
    const snapshot = storedProjectSnapshotSchema.parse(input);
    try {
      await this.db.snapshots.put({
        projectId: snapshot.projectId,
        createdAt: snapshot.createdAt,
        named: snapshot.named,
        kind: snapshot.kind,
        snapshot,
      });
    } catch (error) {
      throw new StorageError("transaction-failed", "Failed to persist project snapshot", error);
    }
  }

  async list(projectId: ProjectId): Promise<StoredProjectSnapshot[]> {
    try {
      const rows = await this.db.snapshots.where("projectId").equals(projectId).toArray();
      return rows
        .map((row) => storedProjectSnapshotSchema.parse(row.snapshot))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    } catch (error) {
      throw new StorageError("transaction-failed", "Failed to list project snapshots", error);
    }
  }

  async delete(projectId: ProjectId, createdAt: string): Promise<void> {
    try {
      await this.db.snapshots.delete([projectId, createdAt]);
    } catch (error) {
      throw new StorageError("transaction-failed", "Failed to delete project snapshot", error);
    }
  }
}
