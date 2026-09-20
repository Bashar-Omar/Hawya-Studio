import * as z from "zod";

import { semanticPageTypeSchema } from "@/domain/guide/page-catalog";

export const templateFamilyIdSchema = z.enum(["essential", "editorial", "grid"]);
export type TemplateFamilyId = z.infer<typeof templateFamilyIdSchema>;

export const templateLocaleModeSchema = z.enum(["en", "ar", "bilingual"]);
export type TemplateLocaleMode = z.infer<typeof templateLocaleModeSchema>;

export const bilingualArrangementSchema = z.enum([
  "side-by-side",
  "stacked-en-ar",
  "stacked-ar-en",
  "mirrored-editorial",
]);
export type BilingualArrangement = z.infer<typeof bilingualArrangementSchema>;

export const templateSlotSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  contentKinds: z
    .array(z.enum(["text", "logo", "colors", "typography", "assets", "rule", "summary"]))
    .min(1),
  required: z.boolean(),
  maxItems: z.number().int().positive().optional(),
  rect: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().positive().max(100),
    height: z.number().positive().max(100),
  }),
});
export type TemplateSlot = z.infer<typeof templateSlotSchema>;

export const pageTemplateSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  familyId: templateFamilyIdSchema,
  variantId: z.string().min(1),
  name: z.string().min(1),
  supportedPageTypes: z.array(semanticPageTypeSchema).min(1),
  supportedLocaleModes: z.array(templateLocaleModeSchema).min(1),
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(["px", "mm", "in", "pt"]),
  }),
  slots: z.array(templateSlotSchema).min(1),
  bilingualArrangement: bilingualArrangementSchema.optional(),
});
export type PageTemplate = z.infer<typeof pageTemplateSchema>;
