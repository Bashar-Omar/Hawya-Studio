import * as z from "zod";

const finiteNonNegative = z.number().finite().nonnegative();

export const smartBoundsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: finiteNonNegative,
  height: finiteNonNegative,
});
export type SmartBounds = z.infer<typeof smartBoundsSchema>;

const normalizedCropSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  width: z.number().finite().min(0).max(1),
  height: z.number().finite().min(0).max(1),
});

export const logoGeometryInsightSchema = z.object({
  kind: z.enum(["svg", "raster"]),
  canvas: z.object({
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  }),
  visibleBounds: smartBoundsSchema,
  aspectRatio: z.number().finite().positive(),
  padding: z.object({
    top: finiteNonNegative,
    right: finiteNonNegative,
    bottom: finiteNonNegative,
    left: finiteNonNegative,
  }),
  cropSuggestion: normalizedCropSchema.optional(),
  paletteCandidates: z.array(z.string().regex(/^#[0-9A-F]{6}$/)).max(12),
});
export type LogoGeometryInsight = z.infer<typeof logoGeometryInsightSchema>;

export type IncorrectUsageKind =
  | "stretch-horizontal"
  | "stretch-vertical"
  | "rotate"
  | "unapproved-color"
  | "drop-shadow"
  | "low-contrast-background"
  | "crop-obstruct"
  | "alter-opacity";

export const INCORRECT_USAGE_CATALOG: readonly IncorrectUsageKind[] = [
  "stretch-horizontal",
  "stretch-vertical",
  "rotate",
  "unapproved-color",
  "drop-shadow",
  "low-contrast-background",
  "crop-obstruct",
  "alter-opacity",
] as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function buildLogoGeometryInsight(
  kind: LogoGeometryInsight["kind"],
  canvas: { width: number; height: number },
  visibleBounds: SmartBounds,
  paletteCandidates: readonly string[] = [],
): LogoGeometryInsight {
  const width = Math.max(0, visibleBounds.width);
  const height = Math.max(0, visibleBounds.height);
  const normalized = {
    x: clamp01(visibleBounds.x / canvas.width),
    y: clamp01(visibleBounds.y / canvas.height),
    width: clamp01(width / canvas.width),
    height: clamp01(height / canvas.height),
  };
  const right = Math.max(0, canvas.width - (visibleBounds.x + width));
  const bottom = Math.max(0, canvas.height - (visibleBounds.y + height));
  const padding = {
    top: Math.max(0, visibleBounds.y),
    right,
    bottom,
    left: Math.max(0, visibleBounds.x),
  };
  const cropIsMeaningful =
    normalized.x > 0.005 ||
    normalized.y > 0.005 ||
    normalized.x + normalized.width < 0.995 ||
    normalized.y + normalized.height < 0.995;
  return logoGeometryInsightSchema.parse({
    kind,
    canvas,
    visibleBounds: { ...visibleBounds, width, height },
    aspectRatio: width > 0 && height > 0 ? width / height : canvas.width / canvas.height,
    padding,
    ...(cropIsMeaningful && width > 0 && height > 0 ? { cropSuggestion: normalized } : {}),
    paletteCandidates: [...new Set(paletteCandidates.map((color) => color.toUpperCase()))].slice(
      0,
      12,
    ),
  });
}

export interface ClearSpaceRuleInput {
  reference: "mark-height" | "custom-fraction" | "manual";
  value: number;
  unit: "ratio" | "px" | "mm";
  note?: string;
}

export interface MinimumSizeRuleInput {
  screenPx?: number;
  printMm?: number;
  note?: string;
}

export function clearSpacePreview(
  analysis: LogoGeometryInsight | undefined,
  rule: ClearSpaceRuleInput,
): number {
  if (rule.reference === "manual") return Math.max(0, rule.value);
  const reference = analysis
    ? Math.min(analysis.visibleBounds.width, analysis.visibleBounds.height)
    : 100;
  return Math.max(0, reference * rule.value);
}
