export interface NormalizedRasterBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RasterPixelInsights {
  visibleBounds?: NormalizedRasterBounds;
  paletteCandidates: string[];
}

interface QuantizedBin {
  count: number;
  r: number;
  g: number;
  b: number;
}

function linearSrgb(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function rgbToOklab(r8: number, g8: number, b8: number): readonly [number, number, number] {
  const r = linearSrgb(r8);
  const g = linearSrgb(g8);
  const b = linearSrgb(b8);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

function perceptualDistance(
  first: readonly [number, number, number],
  second: readonly [number, number, number],
): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

function hex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

function toHex(bin: QuantizedBin): string {
  return `#${hex(bin.r / bin.count)}${hex(bin.g / bin.count)}${hex(bin.b / bin.count)}`;
}

export function analyzeRasterPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: { alphaThreshold?: number; maxColors?: number } = {},
): RasterPixelInsights {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    return { paletteCandidates: [] };
  }
  const alphaThreshold = options.alphaThreshold ?? 12;
  const maxColors = Math.max(1, options.maxColors ?? 8);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const bins = new Map<number, QuantizedBin>();

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3] ?? 0;
    if (alpha <= alphaThreshold) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count += 1;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }

  const ranked = [...bins.values()]
    .sort((a, b) => b.count - a.count || toHex(a).localeCompare(toHex(b)))
    .slice(0, 48);
  const selected: Array<{ color: string; lab: readonly [number, number, number] }> = [];
  for (const bin of ranked) {
    const color = toHex(bin);
    const average = [bin.r / bin.count, bin.g / bin.count, bin.b / bin.count] as const;
    const lab = rgbToOklab(...average);
    if (selected.some((candidate) => perceptualDistance(candidate.lab, lab) < 0.045)) continue;
    selected.push({ color, lab });
    if (selected.length >= maxColors) break;
  }

  const visibleBounds =
    maxX >= minX && maxY >= minY
      ? {
          x: minX / width,
          y: minY / height,
          width: (maxX - minX + 1) / width,
          height: (maxY - minY + 1) / height,
        }
      : undefined;
  return {
    ...(visibleBounds ? { visibleBounds } : {}),
    paletteCandidates: selected.map((item) => item.color),
  };
}
