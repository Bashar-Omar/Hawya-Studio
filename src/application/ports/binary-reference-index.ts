import type { ContentHash } from "@/domain/assets/asset";

export interface BinaryReferenceIndex {
  listReferencedContentHashes(): Promise<Set<ContentHash>>;
}
