import type { BinaryPayload, BinaryStore, StoredBinary } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type { ContentHash } from "@/domain/assets/asset";
import { StorageError } from "@/domain/project/errors";
import type { HawyaDatabase } from "@/infrastructure/db/hawya-database";

export class IndexedDbBinaryStore implements BinaryStore {
  constructor(
    private readonly db: HawyaDatabase,
    private readonly clock: Clock,
  ) {}

  async has(contentHash: ContentHash): Promise<boolean> {
    try {
      return (await this.db.binaries.get(contentHash)) !== undefined;
    } catch (error) {
      throw new StorageError("database-unavailable", "Failed to inspect binary store", error);
    }
  }

  async get(contentHash: ContentHash): Promise<StoredBinary | undefined> {
    try {
      const row = await this.db.binaries.get(contentHash);
      if (!row) {
        return undefined;
      }
      const bytes = new Uint8Array(await row.blob.arrayBuffer());
      return {
        contentHash: row.contentHash,
        mime: row.mime,
        byteLength: row.byteLength,
        bytes,
      };
    } catch (error) {
      throw new StorageError("database-unavailable", "Failed to read binary content", error);
    }
  }

  async put(payload: BinaryPayload): Promise<{ inserted: boolean }> {
    try {
      const existing = await this.db.binaries.get(payload.contentHash);
      if (existing) {
        return { inserted: false };
      }

      const buffer = Uint8Array.from(payload.bytes).buffer;
      try {
        await this.db.binaries.add({
          contentHash: payload.contentHash,
          blob: new Blob([buffer], { type: payload.mime }),
          byteLength: payload.bytes.byteLength,
          mime: payload.mime,
          createdAt: this.clock.now(),
        });
        return { inserted: true };
      } catch (error) {
        if (error instanceof DOMException && error.name === "ConstraintError") {
          return { inserted: false };
        }
        throw error;
      }
    } catch (error) {
      throw new StorageError("transaction-failed", "Failed to persist binary content", error);
    }
  }

  async listContentHashes(): Promise<ContentHash[]> {
    try {
      return await this.db.binaries.toCollection().primaryKeys();
    } catch (error) {
      throw new StorageError("database-unavailable", "Failed to enumerate binary content", error);
    }
  }

  async delete(contentHash: ContentHash): Promise<void> {
    try {
      await this.db.binaries.delete(contentHash);
    } catch (error) {
      throw new StorageError("transaction-failed", "Failed to delete binary content", error);
    }
  }
}
