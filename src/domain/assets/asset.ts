import * as z from "zod";

import { isoDateTimeSchema, uuidSchema } from "@/domain/common/primitives";

export const assetIdSchema = uuidSchema;
export type AssetId = z.infer<typeof assetIdSchema>;

export const assetKindSchema = z.enum([
  "logo",
  "image",
  "vector",
  "font",
  "mockup",
  "icon",
  "illustration",
  "document",
  "attachment",
]);
export type AssetKind = z.infer<typeof assetKindSchema>;

export const contentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type ContentHash = z.infer<typeof contentHashSchema>;

export const assetSchema = z.object({
  id: assetIdSchema,
  projectId: uuidSchema,
  contentHash: contentHashSchema,
  kind: assetKindSchema,
  name: z.string().min(1),
  originalFilename: z.string().min(1),
  mime: z.string().min(1),
  extension: z
    .string()
    .regex(/^[a-z0-9]+$/)
    .optional(),
  byteLength: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  binaryKey: contentHashSchema,
  previewBinaryKey: contentHashSchema.optional(),
  security: z.object({
    sanitized: z.boolean().optional(),
    rejectedFeatures: z.array(z.string()).optional(),
  }),
});
export type Asset = z.infer<typeof assetSchema>;

export const projectAssetRefSchema = z.object({ assetId: assetIdSchema });
export type ProjectAssetRef = z.infer<typeof projectAssetRefSchema>;
