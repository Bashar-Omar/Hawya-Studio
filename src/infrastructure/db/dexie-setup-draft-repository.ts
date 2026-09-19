import type { SetupDraftRepository } from "@/application/ports/setup-draft-repository";
import { StorageError } from "@/domain/project/errors";
import type { ProjectId } from "@/domain/project/hawya-project";
import { type ProjectSetupDraft, projectSetupDraftSchema } from "@/domain/project/setup-draft";
import type { HawyaDatabase } from "@/infrastructure/db/hawya-database";

const PREFIX = "setup-draft:";

function keyFor(projectId: ProjectId): string {
  return `${PREFIX}${projectId}`;
}

function asStorageError(message: string, cause: unknown): StorageError {
  return cause instanceof StorageError
    ? cause
    : new StorageError("transaction-failed", message, cause);
}

export class DexieSetupDraftRepository implements SetupDraftRepository {
  constructor(private readonly db: HawyaDatabase) {}

  async get(projectId: ProjectId): Promise<ProjectSetupDraft | undefined> {
    try {
      const row = await this.db.preferences.get(keyFor(projectId));
      if (!row) {
        return undefined;
      }
      const parsed = projectSetupDraftSchema.safeParse(row.value);
      if (!parsed.success) {
        throw new StorageError(
          "corrupt-persisted-data",
          `Setup draft for ${projectId} failed validation`,
          parsed.error,
        );
      }
      return parsed.data;
    } catch (error) {
      throw asStorageError(`Failed to load setup draft for ${projectId}`, error);
    }
  }

  async list(): Promise<ProjectSetupDraft[]> {
    try {
      const rows = await this.db.preferences.filter((row) => row.key.startsWith(PREFIX)).toArray();
      return rows.map((row) => {
        const parsed = projectSetupDraftSchema.safeParse(row.value);
        if (!parsed.success) {
          throw new StorageError(
            "corrupt-persisted-data",
            `Setup draft ${row.key} failed validation`,
            parsed.error,
          );
        }
        return parsed.data;
      });
    } catch (error) {
      throw asStorageError("Failed to list setup drafts", error);
    }
  }

  async save(draft: ProjectSetupDraft): Promise<void> {
    const parsed = projectSetupDraftSchema.parse(draft);
    try {
      await this.db.preferences.put({ key: keyFor(parsed.projectId), value: parsed });
    } catch (error) {
      throw asStorageError(`Failed to save setup draft for ${parsed.projectId}`, error);
    }
  }

  async delete(projectId: ProjectId): Promise<void> {
    try {
      await this.db.preferences.delete(keyFor(projectId));
    } catch (error) {
      throw asStorageError(`Failed to delete setup draft for ${projectId}`, error);
    }
  }
}
