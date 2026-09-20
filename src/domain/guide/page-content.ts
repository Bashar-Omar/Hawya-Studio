import * as z from "zod";

import { localizedStringSchema, type LocalizedString } from "@/domain/common/primitives";
import {
  pageCatalogEntry,
  semanticPageTypeSchema,
  type SemanticPageType,
} from "@/domain/guide/page-catalog";

export const semanticPageContentSchema = z.object({
  schema: z.literal("hawya.page-content.v1"),
  semanticType: semanticPageTypeSchema,
  title: localizedStringSchema,
  introduction: localizedStringSchema.optional(),
  custom: z.record(z.string(), localizedStringSchema).default({}),
});
export type SemanticPageContent = z.infer<typeof semanticPageContentSchema>;

export function createSemanticPageContent(type: SemanticPageType): SemanticPageContent {
  const entry = pageCatalogEntry(type);
  return semanticPageContentSchema.parse({
    schema: "hawya.page-content.v1",
    semanticType: type,
    title: entry.title,
    introduction: entry.introduction,
    custom: {},
  });
}

export function asSemanticPageContent(
  value: Record<string, unknown>,
): SemanticPageContent | undefined {
  const parsed = semanticPageContentSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function localizedValue(value: LocalizedString | undefined, locale: "en" | "ar"): string {
  if (!value) return "";
  return value[locale] ?? value.en ?? value.ar ?? "";
}
