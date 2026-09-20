import { PAGE_CATALOG, type SemanticPageType } from "@/domain/guide/page-catalog";
import {
  pageTemplateSchema,
  type BilingualArrangement,
  type PageTemplate,
  type TemplateFamilyId,
  type TemplateLocaleMode,
  type TemplateSlot,
} from "@/domain/templates/template-definition";

const PAGE_SLOT_ROLES: Readonly<Record<SemanticPageType, readonly string[]>> = {
  cover: ["brand.name", "brand.descriptor"],
  "brand-overview": ["page.title", "brand.story", "brand.values"],
  "logo-system-intro": ["page.title", "brand.logo.primary", "brand.logo.variants"],
  "primary-logo": ["page.title", "brand.logo.primary", "page.introduction"],
  "logo-clear-space": ["page.title", "brand.logo.primary", "brand.logo.clear-space"],
  "logo-minimum-size": ["page.title", "brand.logo.primary", "brand.logo.minimum-size"],
  "logo-incorrect-usage": ["page.title", "brand.logo.primary", "brand.logo.incorrect-usage"],
  "color-system-intro": ["page.title", "brand.colors.palette", "page.introduction"],
  "color-palette": ["page.title", "brand.colors.palette", "page.introduction"],
  "color-roles": ["page.title", "brand.colors.palette", "page.introduction"],
  "color-contrast": ["page.title", "brand.colors.palette", "page.introduction"],
  "color-print-values": ["page.title", "brand.colors.palette", "page.introduction"],
  "typography-intro": ["page.title", "brand.typography.fonts", "page.introduction"],
  "primary-typeface": ["page.title", "brand.typography.fonts", "page.introduction"],
  "type-hierarchy": ["page.title", "brand.typography.styles", "page.introduction"],
  "arabic-latin-pairing": ["page.title", "brand.typography.fonts", "page.introduction"],
  "asset-library": ["page.title", "project.assets", "page.introduction"],
  "digital-tokens": ["page.title", "brand.colors.palette", "brand.typography.styles"],
  "developer-handoff": ["page.title", "brand.colors.palette", "brand.typography.styles"],
  "production-checklist": ["page.title", "delivery.checklist", "page.introduction"],
  "delivery-summary": ["page.title", "delivery.summary", "page.introduction"],
};

const REQUIRED_ROLES = new Set([
  "brand.name",
  "brand.logo.primary",
  "brand.logo.clear-space",
  "brand.logo.minimum-size",
  "brand.logo.incorrect-usage",
  "brand.colors.palette",
  "brand.typography.fonts",
  "brand.typography.styles",
]);

function kindForRole(role: string): TemplateSlot["contentKinds"][number] {
  if (role.startsWith("brand.logo"))
    return role.includes(".") && role !== "brand.logo.primary" && role !== "brand.logo.variants"
      ? "rule"
      : "logo";
  if (role === "brand.logo.variants") return "logo";
  if (role.startsWith("brand.colors")) return "colors";
  if (role.startsWith("brand.typography")) return "typography";
  if (role === "project.assets") return "assets";
  if (role.startsWith("delivery.")) return "summary";
  return "text";
}

function slotRects(family: TemplateFamilyId, count: number): Array<TemplateSlot["rect"]> {
  if (family === "editorial") {
    return Array.from({ length: count }, (_, index) =>
      index === 0
        ? { x: 8, y: 10, width: 48, height: 24 }
        : { x: 22 + (index - 1) * 3, y: 38 + (index - 1) * 22, width: 68, height: 18 },
    );
  }
  if (family === "grid") {
    return Array.from({ length: count }, (_, index) => ({
      x: index === 0 ? 6 : 6 + ((index - 1) % 2) * 45,
      y: index === 0 ? 7 : 35 + Math.floor((index - 1) / 2) * 28,
      width: index === 0 ? 88 : 40,
      height: index === 0 ? 20 : 22,
    }));
  }
  return Array.from({ length: count }, (_, index) => ({
    x: 10,
    y: index === 0 ? 10 : 32 + (index - 1) * 24,
    width: 80,
    height: index === 0 ? 18 : 20,
  }));
}

function makeTemplate(
  pageType: SemanticPageType,
  familyId: TemplateFamilyId,
  variantId: string,
  modes: readonly TemplateLocaleMode[],
  bilingualArrangement?: BilingualArrangement,
): PageTemplate {
  const roles = PAGE_SLOT_ROLES[pageType];
  const rects = slotRects(familyId, roles.length);
  return pageTemplateSchema.parse({
    id: `${familyId}.${pageType}.${variantId}`,
    version: 1,
    familyId,
    variantId,
    name: `${familyId[0]?.toUpperCase()}${familyId.slice(1)} · ${variantId}`,
    supportedPageTypes: [pageType],
    supportedLocaleModes: modes,
    canvas: { width: 1200, height: 675, unit: "px" },
    slots: roles.map((role, index) => ({
      id: `${variantId}-${index + 1}`,
      role,
      contentKinds: [kindForRole(role)],
      required: REQUIRED_ROLES.has(role),
      rect: rects[index],
    })),
    ...(bilingualArrangement ? { bilingualArrangement } : {}),
  });
}

const templates: PageTemplate[] = [];
for (const entry of PAGE_CATALOG) {
  templates.push(makeTemplate(entry.type, "essential", "standard", ["en", "ar"]));
  templates.push(makeTemplate(entry.type, "editorial", "standard", ["en", "ar"]));
  templates.push(makeTemplate(entry.type, "grid", "standard", ["en", "ar"]));
  templates.push(
    makeTemplate(entry.type, "essential", "bilingual-side-by-side", ["bilingual"], "side-by-side"),
  );
  templates.push(
    makeTemplate(
      entry.type,
      "editorial",
      "bilingual-mirrored",
      ["bilingual"],
      "mirrored-editorial",
    ),
  );
  templates.push(
    makeTemplate(entry.type, "grid", "bilingual-en-ar", ["bilingual"], "stacked-en-ar"),
  );
  templates.push(
    makeTemplate(entry.type, "grid", "bilingual-ar-en", ["bilingual"], "stacked-ar-en"),
  );
}

export const BUILTIN_TEMPLATES: readonly PageTemplate[] = templates;
export const BUILTIN_TEMPLATE_PACK = { id: "builtin-core", version: 1 } as const;
