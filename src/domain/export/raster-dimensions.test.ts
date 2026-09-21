import { describe, expect, it } from "vitest";

import {
  exportUnitToCssPixels,
  rasterPixelDimensions,
} from "@/domain/export/raster-dimensions";

describe("Stage 08 raster dimensions", () => {
  it("converts physical document units at the browser CSS 96 dpi baseline", () => {
    expect(exportUnitToCssPixels(1, "in")).toBe(96);
    expect(exportUnitToCssPixels(25.4, "mm")).toBeCloseTo(96, 8);
    expect(exportUnitToCssPixels(72, "pt")).toBeCloseTo(96, 8);
    expect(exportUnitToCssPixels(640, "px")).toBe(640);
  });

  it("returns exact rounded target pixels for custom scales", () => {
    expect(rasterPixelDimensions(210, 297, "mm", 2)).toEqual({
      width: 1587,
      height: 2245,
      pixels: 3_562_815,
    });
    expect(rasterPixelDimensions(320, 180, "px", 3)).toEqual({
      width: 960,
      height: 540,
      pixels: 518_400,
    });
  });

  it("rejects non-positive or non-finite scales", () => {
    expect(() => rasterPixelDimensions(100, 100, "px", 0)).toThrow();
    expect(() => rasterPixelDimensions(100, 100, "px", Number.NaN)).toThrow();
  });
});
