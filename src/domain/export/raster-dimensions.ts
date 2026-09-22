export type ExportPageUnit = "px" | "mm" | "in" | "pt";

const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;
const POINTS_PER_INCH = 72;

export function exportUnitToCssPixels(value: number, unit: ExportPageUnit): number {
  if (unit === "px") return value;
  if (unit === "in") return value * CSS_PIXELS_PER_INCH;
  if (unit === "mm") return (value * CSS_PIXELS_PER_INCH) / MILLIMETERS_PER_INCH;
  return (value * CSS_PIXELS_PER_INCH) / POINTS_PER_INCH;
}

export interface RasterPixelDimensions {
  width: number;
  height: number;
  pixels: number;
}

export function rasterPixelDimensions(
  width: number,
  height: number,
  unit: ExportPageUnit,
  scale: number,
): RasterPixelDimensions {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("Raster scale must be a positive finite number");
  }
  const targetWidth = Math.max(1, Math.round(exportUnitToCssPixels(width, unit) * scale));
  const targetHeight = Math.max(1, Math.round(exportUnitToCssPixels(height, unit) * scale));
  return {
    width: targetWidth,
    height: targetHeight,
    pixels: targetWidth * targetHeight,
  };
}
