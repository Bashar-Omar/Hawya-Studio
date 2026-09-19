import { describe, expect, it } from "vitest";

import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";

describe("WebCryptoSha256Hasher", () => {
  it("returns deterministic lowercase SHA-256 hex", async () => {
    const hash = await new WebCryptoSha256Hasher().hash(new TextEncoder().encode("hawya"));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(await new WebCryptoSha256Hasher().hash(new TextEncoder().encode("hawya")));
  });
});
