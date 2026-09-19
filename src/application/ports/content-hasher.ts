import type { ContentHash } from "@/domain/assets/asset";

export interface ContentHasher {
  hash(bytes: Uint8Array): Promise<ContentHash>;
}
