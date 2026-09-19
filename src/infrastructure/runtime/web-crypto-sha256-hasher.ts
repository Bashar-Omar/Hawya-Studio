import type { ContentHasher } from "@/application/ports/content-hasher";
import { type ContentHash, contentHashSchema } from "@/domain/assets/asset";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class WebCryptoSha256Hasher implements ContentHasher {
  async hash(bytes: Uint8Array): Promise<ContentHash> {
    const input = Uint8Array.from(bytes);
    const digest = await crypto.subtle.digest("SHA-256", input);
    return contentHashSchema.parse(toHex(new Uint8Array(digest)));
  }
}
