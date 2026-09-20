import * as z from "zod";

import type { LocalizedString } from "@/domain/common/primitives";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";

export const ALL_SEMANTIC_PAGE_TYPES = [
  "cover",
  "contents",
  "brand-overview",
  "brand-story",
  "mission",
  "vision",
  "values",
  "personality",
  "audience",
  "tone-of-voice",
  "logo-system-intro",
  "primary-logo",
  "secondary-logo",
  "logomark",
  "wordmark",
  "logo-lockups",
  "monochrome-logo",
  "reversed-logo",
  "logo-clear-space",
  "logo-minimum-size",
  "logo-backgrounds",
  "logo-incorrect-usage",
  "color-system-intro",
  "color-palette",
  "primary-color",
  "color-roles",
  "color-proportions",
  "color-contrast",
  "color-print-values",
  "gradients",
  "typography-intro",
  "primary-typeface",
  "secondary-typeface",
  "type-hierarchy",
  "type-scale",
  "arabic-latin-pairing",
  "type-usage",
  "type-incorrect-usage",
  "grid-system",
  "spacing-system",
  "visual-language-intro",
  "graphic-devices",
  "patterns-textures",
  "imagery-direction",
  "photography-do-dont",
  "iconography",
  "illustration",
  "motion-guidance",
  "applications-intro",
  "business-card",
  "stationery",
  "presentation",
  "social-post",
  "social-story",
  "website-ui",
  "email-signature",
  "packaging",
  "signage",
  "custom-application",
  "asset-library",
  "digital-tokens",
  "developer-handoff",
  "production-checklist",
  "brand-audit-summary",
  "delivery-summary",
] as const;

export const semanticPageTypeSchema = z.enum(ALL_SEMANTIC_PAGE_TYPES);
export type SemanticPageType = z.infer<typeof semanticPageTypeSchema>;

export const guideSectionTypeSchema = z.enum([
  "overview",
  "strategy",
  "logo",
  "color",
  "typography",
  "visual-language",
  "applications",
  "delivery",
]);
export type GuideSectionType = z.infer<typeof guideSectionTypeSchema>;

export const guideProfileSchema = z.enum(["minimal", "standard", "comprehensive", "custom"]);
export type GuideProfile = z.infer<typeof guideProfileSchema>;

export const pageRequirementSchema = z.enum([
  "brand-name",
  "primary-logo",
  "logo-clear-space",
  "logo-minimum-size",
  "logo-incorrect-usage",
  "colors",
  "fonts",
  "text-styles",
  "bilingual",
  "assets",
  "digital",
]);
export type PageRequirement = z.infer<typeof pageRequirementSchema>;

export interface PageCatalogEntry {
  type: SemanticPageType;
  section: GuideSectionType;
  title: LocalizedString;
  introduction: LocalizedString;
  requirements: readonly PageRequirement[];
}

const entries: PageCatalogEntry[] = [
  {
    type: "cover",
    section: "overview",
    title: { en: "Brand Guidelines", ar: "دليل الهوية" },
    introduction: {
      en: "A living guide generated from the canonical Brand System.",
      ar: "دليل حي يتم توليده من نظام الهوية الأساسي.",
    },
    requirements: ["brand-name"],
  },
  {
    type: "brand-overview",
    section: "overview",
    title: { en: "Brand Overview", ar: "نظرة عامة على العلامة" },
    introduction: {
      en: "The core identity, story, descriptor and strategic context available in the project.",
      ar: "الهوية الأساسية والقصة والوصف والسياق الاستراتيجي المتاح داخل المشروع.",
    },
    requirements: ["brand-name"],
  },
  {
    type: "logo-system-intro",
    section: "logo",
    title: { en: "Logo System", ar: "نظام الشعار" },
    introduction: {
      en: "Approved logo variants and the rules that keep them consistent.",
      ar: "نسخ الشعار المعتمدة والقواعد التي تحافظ على اتساق استخدامها.",
    },
    requirements: ["primary-logo"],
  },
  {
    type: "primary-logo",
    section: "logo",
    title: { en: "Primary Logo", ar: "الشعار الأساسي" },
    introduction: {
      en: "The preferred logo signature for default brand use.",
      ar: "نسخة الشعار المفضلة للاستخدام الأساسي للعلامة.",
    },
    requirements: ["primary-logo"],
  },
  {
    type: "logo-clear-space",
    section: "logo",
    title: { en: "Clear Space", ar: "المساحة الآمنة" },
    introduction: {
      en: "Protected space keeps the mark visually independent from surrounding content.",
      ar: "المساحة المحمية تحافظ على استقلال الشعار بصريًا عن العناصر المحيطة.",
    },
    requirements: ["primary-logo", "logo-clear-space"],
  },
  {
    type: "logo-minimum-size",
    section: "logo",
    title: { en: "Minimum Size", ar: "الحد الأدنى للحجم" },
    introduction: {
      en: "Minimum-size rules protect legibility across applications.",
      ar: "قواعد الحد الأدنى للحجم تحافظ على وضوح الشعار في التطبيقات المختلفة.",
    },
    requirements: ["primary-logo", "logo-minimum-size"],
  },
  {
    type: "logo-incorrect-usage",
    section: "logo",
    title: { en: "Incorrect Usage", ar: "الاستخدامات غير الصحيحة" },
    introduction: {
      en: "Avoid transformations and treatments that weaken recognition.",
      ar: "تجنب التحويلات والمعالجات التي تضعف التعرف على الشعار.",
    },
    requirements: ["primary-logo", "logo-incorrect-usage"],
  },
  {
    type: "color-system-intro",
    section: "color",
    title: { en: "Color System", ar: "نظام الألوان" },
    introduction: {
      en: "The palette is defined as reusable global tokens with explicit semantic roles.",
      ar: "يتم تعريف لوحة الألوان كرموز عامة قابلة لإعادة الاستخدام بأدوار دلالية واضحة.",
    },
    requirements: ["colors"],
  },
  {
    type: "color-palette",
    section: "color",
    title: { en: "Color Palette", ar: "لوحة الألوان" },
    introduction: {
      en: "Canonical color tokens and their current screen values.",
      ar: "رموز الألوان الأساسية وقيمها الحالية للشاشات.",
    },
    requirements: ["colors"],
  },
  {
    type: "color-roles",
    section: "color",
    title: { en: "Color Roles", ar: "أدوار الألوان" },
    introduction: {
      en: "Use semantic roles to keep color decisions consistent across touchpoints.",
      ar: "استخدم الأدوار الدلالية للحفاظ على اتساق قرارات الألوان عبر التطبيقات.",
    },
    requirements: ["colors"],
  },
  {
    type: "color-contrast",
    section: "color",
    title: { en: "Contrast & Accessibility", ar: "التباين وإمكانية الوصول" },
    introduction: {
      en: "Review combinations in context and verify accessibility for real content.",
      ar: "راجع تركيبات الألوان في سياقها وتحقق من إمكانية الوصول للمحتوى الحقيقي.",
    },
    requirements: ["colors"],
  },
  {
    type: "color-print-values",
    section: "color",
    title: { en: "Print Color Values", ar: "قيم ألوان الطباعة" },
    introduction: {
      en: "Suggested print conversions remain distinct from user-verified production values.",
      ar: "تظل اقتراحات ألوان الطباعة منفصلة عن قيم الإنتاج التي تم التحقق منها يدويًا.",
    },
    requirements: ["colors"],
  },
  {
    type: "typography-intro",
    section: "typography",
    title: { en: "Typography System", ar: "نظام الخطوط" },
    introduction: {
      en: "Brand fonts and reusable type-style tokens form the typography system.",
      ar: "تشكل خطوط العلامة وأنماط الكتابة القابلة لإعادة الاستخدام نظام الخطوط.",
    },
    requirements: ["fonts"],
  },
  {
    type: "primary-typeface",
    section: "typography",
    title: { en: "Primary Typeface", ar: "الخط الأساسي" },
    introduction: {
      en: "The primary uploaded font is shown from the local project asset.",
      ar: "يتم عرض الخط الأساسي المرفوع من أصل المشروع المحلي.",
    },
    requirements: ["fonts"],
  },
  {
    type: "type-hierarchy",
    section: "typography",
    title: { en: "Type Hierarchy", ar: "التسلسل الهرمي للخطوط" },
    introduction: {
      en: "Reusable type-style tokens define hierarchy without copying typography values.",
      ar: "تحدد رموز أنماط الكتابة التسلسل الهرمي بدون نسخ قيم الخطوط.",
    },
    requirements: ["text-styles"],
  },
  {
    type: "arabic-latin-pairing",
    section: "typography",
    title: { en: "Arabic / Latin Pairing", ar: "تنسيق العربية واللاتينية" },
    introduction: {
      en: "Bilingual typography keeps language and direction explicit while sharing one semantic system.",
      ar: "تحافظ الخطوط ثنائية اللغة على وضوح اللغة والاتجاه مع مشاركة نظام دلالي واحد.",
    },
    requirements: ["fonts", "bilingual"],
  },
  {
    type: "asset-library",
    section: "delivery",
    title: { en: "Asset Library", ar: "مكتبة الأصول" },
    introduction: {
      en: "Project assets remain referenceable by stable semantic IDs.",
      ar: "تظل أصول المشروع قابلة للإشارة عبر معرفات دلالية ثابتة.",
    },
    requirements: ["assets"],
  },
  {
    type: "digital-tokens",
    section: "delivery",
    title: { en: "Digital Tokens", ar: "الرموز الرقمية" },
    introduction: {
      en: "Reusable color and typography tokens are the implementation source of truth.",
      ar: "رموز الألوان والخطوط القابلة لإعادة الاستخدام هي مصدر الحقيقة للتنفيذ.",
    },
    requirements: ["colors", "text-styles"],
  },
  {
    type: "developer-handoff",
    section: "delivery",
    title: { en: "Developer Handoff", ar: "تسليم المطور" },
    introduction: {
      en: "A concise implementation view of reusable brand tokens and assets.",
      ar: "عرض تنفيذي مختصر لرموز وأصول العلامة القابلة لإعادة الاستخدام.",
    },
    requirements: ["colors"],
  },
  {
    type: "production-checklist",
    section: "delivery",
    title: { en: "Production Checklist", ar: "قائمة مراجعة الإنتاج" },
    introduction: {
      en: "Review unresolved inputs before delivery or production use.",
      ar: "راجع المدخلات غير المكتملة قبل التسليم أو الاستخدام الإنتاجي.",
    },
    requirements: [],
  },
  {
    type: "delivery-summary",
    section: "delivery",
    title: { en: "Delivery Summary", ar: "ملخص التسليم" },
    introduction: {
      en: "A snapshot of the reusable brand system contained in this project.",
      ar: "ملخص لنظام الهوية القابل لإعادة الاستخدام الموجود داخل هذا المشروع.",
    },
    requirements: [],
  },
];

function humanizePageType(type: SemanticPageType): string {
  return type.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function catalogSection(type: SemanticPageType): GuideSectionType {
  const index = ALL_SEMANTIC_PAGE_TYPES.indexOf(type);
  if (index <= 2) return "overview";
  if (index <= 9) return "strategy";
  if (index <= 21) return "logo";
  if (index <= 29) return "color";
  if (index <= 37) return "typography";
  if (index <= 47) return "visual-language";
  if (index <= 58) return "applications";
  return "delivery";
}

const representativeEntries = new Map(entries.map((entry) => [entry.type, entry] as const));

export const FULL_PAGE_CATALOG: readonly PageCatalogEntry[] = ALL_SEMANTIC_PAGE_TYPES.map(
  (type) =>
    representativeEntries.get(type) ?? {
      type,
      section: catalogSection(type),
      title: { en: humanizePageType(type) },
      introduction: {
        en: `Semantic content contract for the ${humanizePageType(type)} guideline page.`,
      },
      requirements: [],
    },
);

export const PAGE_CATALOG: readonly PageCatalogEntry[] = entries;

export const PROFILE_PAGE_TYPES: Readonly<
  Record<Exclude<GuideProfile, "custom">, readonly SemanticPageType[]>
> = {
  minimal: [
    "cover",
    "brand-overview",
    "primary-logo",
    "logo-clear-space",
    "logo-incorrect-usage",
    "color-palette",
    "primary-typeface",
    "type-hierarchy",
    "asset-library",
    "production-checklist",
    "delivery-summary",
  ],
  standard: [
    "cover",
    "brand-overview",
    "logo-system-intro",
    "primary-logo",
    "logo-clear-space",
    "logo-minimum-size",
    "logo-incorrect-usage",
    "color-system-intro",
    "color-palette",
    "color-roles",
    "color-contrast",
    "color-print-values",
    "typography-intro",
    "primary-typeface",
    "type-hierarchy",
    "arabic-latin-pairing",
    "asset-library",
    "production-checklist",
    "delivery-summary",
  ],
  comprehensive: entries.map((entry) => entry.type),
};

export const SECTION_TITLES: Readonly<Record<GuideSectionType, LocalizedString>> = {
  overview: { en: "Overview", ar: "نظرة عامة" },
  strategy: { en: "Strategy", ar: "الاستراتيجية" },
  logo: { en: "Logo", ar: "الشعار" },
  color: { en: "Color", ar: "الألوان" },
  typography: { en: "Typography", ar: "الخطوط" },
  "visual-language": { en: "Visual Language", ar: "اللغة البصرية" },
  applications: { en: "Applications", ar: "التطبيقات" },
  delivery: { en: "Delivery", ar: "التسليم" },
};

export function pageCatalogEntry(type: SemanticPageType): PageCatalogEntry {
  const entry = FULL_PAGE_CATALOG.find((candidate) => candidate.type === type);
  if (!entry) throw new Error(`Unknown semantic page type: ${type}`);
  return entry;
}

export function requirementAvailable(
  snapshot: ProjectSnapshot,
  requirement: PageRequirement,
): boolean {
  const { brand } = snapshot.project;
  switch (requirement) {
    case "brand-name":
      return Boolean(brand.identity.brandName.en ?? brand.identity.brandName.ar);
    case "primary-logo":
      return Boolean(
        brand.logos.primaryLogoId &&
          brand.logos.variants.some((variant) => variant.id === brand.logos.primaryLogoId),
      );
    case "logo-clear-space":
      return Boolean(brand.logos.rules.clearSpace);
    case "logo-minimum-size":
      return Boolean(brand.logos.rules.minimumSize);
    case "logo-incorrect-usage":
      return brand.logos.rules.incorrectUsage.length > 0;
    case "colors":
      return brand.colors.tokens.length > 0;
    case "fonts":
      return brand.typography.fonts.length > 0;
    case "text-styles":
      return brand.typography.styles.length > 0;
    case "bilingual":
      return (
        brand.typography.fonts.length > 0 &&
        snapshot.project.settings.enabledContentLocales.includes("en") &&
        snapshot.project.settings.enabledContentLocales.includes("ar")
      );
    case "assets":
      return snapshot.assets.length > 0;
    case "digital":
      return Boolean(brand.digital && Object.keys(brand.digital).length > 0);
  }
}

export function pageAvailable(snapshot: ProjectSnapshot, type: SemanticPageType): boolean {
  return pageCatalogEntry(type).requirements.every((requirement) =>
    requirementAvailable(snapshot, requirement),
  );
}
