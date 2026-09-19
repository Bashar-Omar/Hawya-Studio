import * as z from "zod";

export const uuidSchema = z.uuid();
export type UUID = z.infer<typeof uuidSchema>;

export const isoDateTimeSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), "Timestamp must be an ISO 8601 UTC string");
export type ISODateTime = z.infer<typeof isoDateTimeSchema>;

export const localeSchema = z.enum(["en", "ar"]);
export type ContentLocale = z.infer<typeof localeSchema>;

export const directionSchema = z.enum(["ltr", "rtl"]);
export type ContentDirection = z.infer<typeof directionSchema>;

export const localizedStringSchema = z
  .object({
    en: z.string().optional(),
    ar: z.string().optional(),
  })
  .refine((value) => value.en !== undefined || value.ar !== undefined, {
    error: "At least one localized value is required",
  });
export type LocalizedString = z.infer<typeof localizedStringSchema>;

export const localizedRichTextSchema = localizedStringSchema;
export type LocalizedRichText = z.infer<typeof localizedRichTextSchema>;

export const solidPaintSchema = z.object({
  type: z.literal("solid"),
  color: z.string().min(1),
  alpha: z.number().min(0).max(1).default(1),
});

export const paintSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  solidPaintSchema,
]);
export type Paint = z.infer<typeof paintSchema>;

export const normalizedRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});
export type NormalizedRect = z.infer<typeof normalizedRectSchema>;
