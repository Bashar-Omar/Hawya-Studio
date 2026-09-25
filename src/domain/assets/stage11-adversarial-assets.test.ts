import { describe, expect, it } from "vitest";

import {
  ASSET_HARD_LIMIT_BYTES,
  detectAssetFile,
  validateAssetSize,
  validateDeclaredAssetType,
} from "@/domain/assets/asset-policy";

describe("Stage 11 adversarial asset policy", () => {
  it("rejects truncated and unknown binary signatures", () => {
    expect(detectAssetFile(Uint8Array.from([]))).toBeUndefined();
    expect(detectAssetFile(Uint8Array.from([0x89, 0x50, 0x4e]))).toBeUndefined();
    expect(detectAssetFile(new TextEncoder().encode("MZ-not-an-asset"))).toBeUndefined();
  });

  it("rejects declared filename and MIME mismatches after signature sniffing", () => {
    const png = detectAssetFile(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png).toBeDefined();
    if (!png) return;

    expect(() => validateDeclaredAssetType(png, "payload.svg", "image/svg+xml")).toThrow(
      /extension/i,
    );
    expect(() => validateDeclaredAssetType(png, "payload.png", "font/woff2")).toThrow(/MIME/i);
  });

  it("enforces the local hard-size ceiling without allocating an oversized fixture", () => {
    expect(() => validateAssetSize(ASSET_HARD_LIMIT_BYTES)).not.toThrow();
    expect(() => validateAssetSize(ASSET_HARD_LIMIT_BYTES + 1)).toThrow(/hard local safety limit/i);
  });
});
