import type { ContentHash } from "@/domain/assets/asset";

export interface BinaryPayload {
  contentHash: ContentHash;
  mime: string;
  bytes: Uint8Array;
}

export interface StoredBinary extends BinaryPayload {
  byteLength: number;
}

export interface BinaryStore {
  has(contentHash: ContentHash): Promise<boolean>;
  get(contentHash: ContentHash): Promise<StoredBinary | undefined>;
  put(payload: BinaryPayload): Promise<{ inserted: boolean }>;
  listContentHashes(): Promise<ContentHash[]>;
  delete(contentHash: ContentHash): Promise<void>;
}
