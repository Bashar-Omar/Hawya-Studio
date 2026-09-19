import type { BinaryReferenceIndex } from "@/application/ports/binary-reference-index";
import type { BinaryStore } from "@/application/ports/binary-store";
import type { ContentHash } from "@/domain/assets/asset";

export interface BinaryGarbageCollectionResult {
  deleted: ContentHash[];
  retained: ContentHash[];
}

export class GarbageCollectBinariesUseCase {
  constructor(
    private readonly binaries: BinaryStore,
    private readonly references: BinaryReferenceIndex,
  ) {}

  async execute(): Promise<BinaryGarbageCollectionResult> {
    const [stored, referenced] = await Promise.all([
      this.binaries.listContentHashes(),
      this.references.listReferencedContentHashes(),
    ]);

    const deleted: ContentHash[] = [];
    const retained: ContentHash[] = [];
    for (const hash of stored.sort()) {
      if (referenced.has(hash)) {
        retained.push(hash);
        continue;
      }
      await this.binaries.delete(hash);
      deleted.push(hash);
    }

    return { deleted, retained };
  }
}
