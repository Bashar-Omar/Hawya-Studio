import { describe, expect, it } from "vitest";

import { selectMeaningfulContrastPairs } from "@/domain/smart/contrast-matrix";
import {
  buildLogoGeometryInsight,
  clearSpacePreview,
  INCORRECT_USAGE_CATALOG,
} from "@/domain/smart/logo-analysis";
import { analyzeRasterPixels } from "@/domain/smart/raster-insights";
import type { ColorToken } from "@/domain/brand/brand-system";

function pixelBuffer(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4);
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  rgba: readonly [number, number, number, number],
): void {
  data.set(rgba, (y * width + x) * 4);
}

function token(id: string, role: ColorToken["role"], hex: string): ColorToken {
  return {
    id,
    name: { en: id },
    role,
    srgbHex: hex,
    alpha: 1,
    rgb: { r: 0, g: 0, b: 0 },
  } as ColorToken;
}

describe("Stage 07 deterministic smart engines", () => {
  it("extracts deterministic raster alpha bounds and perceptually de-duplicated palette candidates", () => {
    const data = pixelBuffer(6, 5);
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        setPixel(data, 6, x, y, x === 4 ? [250, 5, 5, 255] : [255, 0, 0, 255]);
      }
    }
    setPixel(data, 6, 3, 2, [0, 0, 255, 255]);

    const first = analyzeRasterPixels(data, 6, 5, { maxColors: 4 });
    const second = analyzeRasterPixels(data, 6, 5, { maxColors: 4 });
    expect(second).toEqual(first);
    expect(first.visibleBounds).toEqual({ x: 2 / 6, y: 1 / 5, width: 3 / 6, height: 3 / 5 });
    expect(first.paletteCandidates[0]).toMatch(/^#[0-9A-F]{6}$/);
    expect(first.paletteCandidates.length).toBeGreaterThanOrEqual(2);
  });

  it("measures logo padding and crop without promoting suggestions into professional rules", () => {
    const insight = buildLogoGeometryInsight(
      "svg",
      { width: 100, height: 80 },
      { x: 20, y: 10, width: 60, height: 50 },
      ["#123456", "#123456", "#FFFFFF"],
    );
    expect(insight.padding).toEqual({ top: 10, right: 20, bottom: 20, left: 20 });
    expect(insight.cropSuggestion).toEqual({ x: 0.2, y: 0.125, width: 0.6, height: 0.625 });
    expect(insight.paletteCandidates).toEqual(["#123456", "#FFFFFF"]);
    expect(
      clearSpacePreview(insight, { reference: "mark-height", value: 0.5, unit: "ratio" }),
    ).toBe(25);
  });

  it("keeps incorrect-use generation finite and deterministic", () => {
    expect(INCORRECT_USAGE_CATALOG).toEqual([
      "stretch-horizontal",
      "stretch-vertical",
      "rotate",
      "unapproved-color",
      "drop-shadow",
      "low-contrast-background",
      "crop-obstruct",
      "alter-opacity",
    ]);
  });

  it("selects a stable bounded contrast subset with neutral pairs prioritized", () => {
    const tokens = [
      token("00000000-0000-4000-8000-000000000101", "primary", "#111111"),
      token("00000000-0000-4000-8000-000000000102", "accent", "#FF0000"),
      token("00000000-0000-4000-8000-000000000103", "neutral", "#FFFFFF"),
      token("00000000-0000-4000-8000-000000000104", "supporting", "#00FF00"),
    ];
    const first = selectMeaningfulContrastPairs(tokens, 3);
    expect(first).toHaveLength(3);
    expect(first).toEqual(selectMeaningfulContrastPairs(tokens, 3));
    expect(
      first.some((pair) => pair.foregroundId.endsWith("103") || pair.backgroundId.endsWith("103")),
    ).toBe(true);
  });
});
