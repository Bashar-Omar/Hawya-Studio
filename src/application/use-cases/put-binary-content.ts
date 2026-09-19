import type { BinaryStore } from "@/application/ports/binary-store";
import type { ContentHasher } from "@/application/ports/content-hasher";
import type { ContentHash } from "@/domain/assets/asset";

export interface PutBinaryContentInput {
  bytes: Uint8Array;
  mime: string;
}

export interface PutBinaryContentResult {
  contentHash: ContentHash;
  inserted: boolean;
}

export class PutBinaryContentUseCase {
  constructor(
    private readonly hasher: ContentHasher,
    private readonly binaryStore: BinaryStore,
  ) {}

  async execute(input: PutBinaryContentInput): Promise<PutBinaryContentResult> {
    const contentHash = await this.hasher.hash(input.bytes);
    const result = await this.binaryStore.put({
      contentHash,
      mime: input.mime,
      bytes: input.bytes,
    });
    return { contentHash, inserted: result.inserted };
  }
}
