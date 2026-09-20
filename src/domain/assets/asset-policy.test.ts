import { describe, expect, it } from "vitest";

import {
  detectAssetFile,
  validateAssetSize,
  validateDeclaredAssetType,
} from "@/domain/assets/asset-policy";

describe("asset import policy", () => {
  it("sniffs SVG, PNG and font signatures instead of trusting extensions", () => {
    expect(
      detectAssetFile(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))
        ?.format,
    ).toBe("svg");
    expect(
      detectAssetFile(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.format,
    ).toBe("png");
    expect(detectAssetFile(new TextEncoder().encode("wOF2font-data"))?.format).toBe("woff2");
  });

  it("rejects extension/content mismatches and empty files", () => {
    const detected = detectAssetFile(
      new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    );
    expect(detected).toBeDefined();
    if (!detected) return;
    expect(() => validateDeclaredAssetType(detected, "logo.png", "image/png")).toThrow(
      /extension/i,
    );
    expect(() => validateAssetSize(0)).toThrow(/empty/i);
  });
});
