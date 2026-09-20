import * as z from "zod";

const fontAxisSchema = z.object({
  tag: z.string().length(4),
  min: z.number(),
  default: z.number(),
  max: z.number(),
});

export const fontAssetMetadataSchema = z.object({
  detectedFormat: z.string(),
  ingestedAt: z.string(),
  familyName: z.string().min(1),
  subfamilyName: z.string().optional(),
  postscriptName: z.string().optional(),
  weight: z.number().int().min(1).max(1000).optional(),
  style: z.enum(["normal", "italic", "oblique"]).optional(),
  variableAxes: z.array(fontAxisSchema).optional(),
  coverage: z.object({
    arabic: z.object({
      supported: z.number().int().nonnegative(),
      total: z.number().int().positive(),
      ratio: z.number().min(0).max(1),
      missingCodePoints: z.array(z.number().int().nonnegative()),
      hasGsub: z.boolean(),
      hasGpos: z.boolean(),
    }),
    characterCount: z.number().int().nonnegative(),
  }),
});

export type FontAssetMetadata = z.infer<typeof fontAssetMetadataSchema>;
