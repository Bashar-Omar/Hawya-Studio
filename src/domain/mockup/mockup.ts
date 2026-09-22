import * as z from "zod";

import { assetIdSchema } from "@/domain/assets/asset";
import { isoDateTimeSchema, normalizedRectSchema, uuidSchema } from "@/domain/common/primitives";
import { pageIdSchema } from "@/domain/guide/guide-document";

const positiveNormalizedRectSchema = normalizedRectSchema.refine(
  (rect) =>
    rect.width > 0 && rect.height > 0 && rect.x + rect.width <= 1 && rect.y + rect.height <= 1,
  "Crop must have positive size and stay inside the source image",
);

export const mockupPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type MockupPoint = z.infer<typeof mockupPointSchema>;

export const mockupQuadSchema = z.object({
  topLeft: mockupPointSchema,
  topRight: mockupPointSchema,
  bottomRight: mockupPointSchema,
  bottomLeft: mockupPointSchema,
});
export type MockupQuad = z.infer<typeof mockupQuadSchema>;

export const mockupArtworkSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("asset"), assetId: assetIdSchema }),
  z.object({ kind: z.literal("page"), pageId: pageIdSchema }),
]);
export type MockupArtworkSource = z.infer<typeof mockupArtworkSourceSchema>;

export const mockupSurfaceSchema = z.object({
  corners: mockupQuadSchema,
  artwork: mockupArtworkSourceSchema,
  opacity: z.number().min(0).max(1),
  blendMode: z.enum(["normal", "multiply", "screen"]),
  shadowStrength: z.number().min(0).max(1),
  highlightStrength: z.number().min(0).max(1),
});
export type MockupSurface = z.infer<typeof mockupSurfaceSchema>;

export const mockupPresetSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(120),
  backgroundAssetId: assetIdSchema,
  crop: positiveNormalizedRectSchema,
  surface: mockupSurfaceSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type MockupPreset = z.infer<typeof mockupPresetSchema>;

export const mockupCollectionSchema = z.object({
  presets: z.array(mockupPresetSchema),
});
export type MockupCollection = z.infer<typeof mockupCollectionSchema>;

export const DEFAULT_MOCKUP_CROP = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });
export const DEFAULT_MOCKUP_QUAD = Object.freeze({
  topLeft: { x: 0.2, y: 0.2 },
  topRight: { x: 0.8, y: 0.2 },
  bottomRight: { x: 0.8, y: 0.8 },
  bottomLeft: { x: 0.2, y: 0.8 },
});

export function cloneDefaultMockupCrop() {
  return { ...DEFAULT_MOCKUP_CROP };
}

export function cloneDefaultMockupQuad(): MockupQuad {
  return {
    topLeft: { ...DEFAULT_MOCKUP_QUAD.topLeft },
    topRight: { ...DEFAULT_MOCKUP_QUAD.topRight },
    bottomRight: { ...DEFAULT_MOCKUP_QUAD.bottomRight },
    bottomLeft: { ...DEFAULT_MOCKUP_QUAD.bottomLeft },
  };
}
