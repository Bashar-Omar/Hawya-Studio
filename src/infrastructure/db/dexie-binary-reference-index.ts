import type { BinaryReferenceIndex } from "@/application/ports/binary-reference-index";
import type { ContentHash } from "@/domain/assets/asset";
import { StorageError } from "@/domain/project/errors";
import type { HawyaDatabase } from "@/infrastructure/db/hawya-database";

export class DexieBinaryReferenceIndex implements BinaryReferenceIndex {
  constructor(private readonly db: HawyaDatabase) {}

  async listReferencedContentHashes(): Promise<Set<ContentHash>> {
    try {
      const [assetRows, snapshotRows] = await this.db.transaction(
        "r",
        this.db.projectAssets,
        this.db.snapshots,
        async () => Promise.all([this.db.projectAssets.toArray(), this.db.snapshots.toArray()]),
      );

      const referenced = new Set<ContentHash>(assetRows.map((row) => row.contentHash));
      for (const row of snapshotRows) {
        for (const hash of row.snapshot.binaryHashes) {
          referenced.add(hash);
        }
      }
      return referenced;
    } catch (error) {
      throw new StorageError("transaction-failed", "Failed to scan binary references", error);
    }
  }
}
