import type { ColorChannels, ColorEngine } from "@/application/ports/color-engine";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

type ColorConstructor = typeof import("colorjs.io")["default"];

let colorModulePromise: Promise<ColorConstructor> | undefined;

async function getColorConstructor(): Promise<ColorConstructor> {
  colorModulePromise ??= import("colorjs.io").then((module) => module.default);
  return colorModulePromise;
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function finiteChannel(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function genericCmyk(rgb: { r: number; g: number; b: number }) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 0.999999) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  return {
    c: round(((1 - r - k) / (1 - k)) * 100, 2),
    m: round(((1 - g - k) / (1 - k)) * 100, 2),
    y: round(((1 - b - k) / (1 - k)) * 100, 2),
    k: round(k * 100, 2),
  };
}

export class ColorJsColorEngine implements ColorEngine {
  async derive(hex: string): Promise<ColorChannels> {
    if (!HEX_COLOR.test(hex)) {
      throw new Error("Color must be a six-digit HEX value");
    }
    const Color = await getColorConstructor();
    const source = new Color(hex);
    const [rawR, rawG, rawB] = source.to("srgb").coords;
    const [rawH, rawS, rawL] = source.to("hsl").coords;
    const [rawOkL, rawC, rawOkH] = source.to("oklch").coords;
    const r = finiteChannel(rawR);
    const g = finiteChannel(rawG);
    const b = finiteChannel(rawB);
    const h = finiteChannel(rawH);
    const s = finiteChannel(rawS);
    const l = finiteChannel(rawL);
    const okL = finiteChannel(rawOkL);
    const c = finiteChannel(rawC);
    const okH = finiteChannel(rawOkH);
    const rgb = {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
    return {
      rgb,
      hsl: { h: round(h), s: round(s), l: round(l) },
      oklch: { l: round(okL), c: round(c), h: round(okH) },
      suggestedCmyk: genericCmyk(rgb),
    };
  }

  async contrast(foregroundHex: string, backgroundHex: string): Promise<number> {
    const Color = await getColorConstructor();
    const foreground = new Color(foregroundHex);
    return round(foreground.contrast(new Color(backgroundHex), "WCAG21"), 2);
  }
}
