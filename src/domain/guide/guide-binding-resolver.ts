import type { Asset } from "@/domain/assets/asset";
import type {
  ColorToken,
  FontAssetRef,
  LogoVariant,
  TextStyleToken,
} from "@/domain/brand/brand-system";
import type { LocalizedString } from "@/domain/common/primitives";
import type { ContentBinding, GuidePage } from "@/domain/guide/guide-document";
import { asSemanticPageContent } from "@/domain/guide/page-content";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";

export type ResolvedBindingValue =
  | { kind: "localized-text"; value: LocalizedString }
  | { kind: "logos"; variants: LogoVariant[] }
  | { kind: "colors"; tokens: ColorToken[] }
  | { kind: "fonts"; fonts: FontAssetRef[] }
  | { kind: "text-styles"; styles: TextStyleToken[] }
  | { kind: "assets"; assets: Asset[] }
  | { kind: "rule"; value: Record<string, unknown> | Record<string, unknown>[] }
  | {
      kind: "summary";
      values: { assets: number; logos: number; colors: number; fonts: number; textStyles: number };
    }
  | { kind: "checklist"; items: LocalizedString[] };

function pageContentText(
  page: GuidePage,
  key: "title" | "introduction",
): LocalizedString | undefined {
  const semantic = asSemanticPageContent(page.content);
  if (semantic) return semantic[key];
  const value = page.content[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const en = typeof candidate.en === "string" ? candidate.en : undefined;
  const ar = typeof candidate.ar === "string" ? candidate.ar : undefined;
  return en !== undefined || ar !== undefined
    ? { ...(en ? { en } : {}), ...(ar ? { ar } : {}) }
    : undefined;
}

export function resolveContentBinding(
  snapshot: ProjectSnapshot,
  page: GuidePage,
  binding: ContentBinding,
): ResolvedBindingValue | undefined {
  const { brand } = snapshot.project;
  switch (binding) {
    case "page.content.title": {
      const value = pageContentText(page, "title") ?? page.name;
      return { kind: "localized-text", value };
    }
    case "page.content.introduction": {
      const value = pageContentText(page, "introduction");
      return value ? { kind: "localized-text", value } : undefined;
    }
    case "brand.identity.brandName":
      return { kind: "localized-text", value: brand.identity.brandName };
    case "brand.identity.descriptor":
      return brand.identity.descriptor
        ? { kind: "localized-text", value: brand.identity.descriptor }
        : undefined;
    case "brand.identity.story":
      return brand.identity.story
        ? { kind: "localized-text", value: brand.identity.story }
        : undefined;
    case "brand.identity.values[]":
      return brand.identity.values.length
        ? {
            kind: "localized-text",
            value: {
              en: brand.identity.values
                .map((value) => value.name.en ?? value.name.ar)
                .filter(Boolean)
                .join(" · "),
              ar: brand.identity.values
                .map((value) => value.name.ar ?? value.name.en)
                .filter(Boolean)
                .join(" · "),
            },
          }
        : undefined;
    case "brand.logo.primary": {
      const primary = brand.logos.variants.find(
        (variant) => variant.id === brand.logos.primaryLogoId,
      );
      return primary ? { kind: "logos", variants: [primary] } : undefined;
    }
    case "brand.logo.variants[]":
      return brand.logos.variants.length
        ? { kind: "logos", variants: brand.logos.variants }
        : undefined;
    case "brand.logo.clearSpace":
      return brand.logos.rules.clearSpace
        ? { kind: "rule", value: brand.logos.rules.clearSpace.data }
        : undefined;
    case "brand.logo.minimumSize":
      return brand.logos.rules.minimumSize
        ? { kind: "rule", value: brand.logos.rules.minimumSize.data }
        : undefined;
    case "brand.logo.incorrectUsage[]":
      return brand.logos.rules.incorrectUsage.length
        ? { kind: "rule", value: brand.logos.rules.incorrectUsage.map((rule) => rule.data) }
        : undefined;
    case "brand.colors.tokens[]":
      return brand.colors.tokens.length
        ? { kind: "colors", tokens: brand.colors.tokens }
        : undefined;
    case "brand.typography.fonts[]":
      return brand.typography.fonts.length
        ? { kind: "fonts", fonts: brand.typography.fonts }
        : undefined;
    case "brand.typography.styles[]":
      return brand.typography.styles.length
        ? { kind: "text-styles", styles: brand.typography.styles }
        : undefined;
    case "project.assets[]":
      return snapshot.assets.length ? { kind: "assets", assets: snapshot.assets } : undefined;
    case "delivery.checklist":
      return {
        kind: "checklist",
        items: [
          { en: "Review missing guide inputs", ar: "راجع بيانات الدليل المفقودة" },
          { en: "Verify print values before production", ar: "تحقق من قيم الطباعة قبل الإنتاج" },
          { en: "Confirm font and asset usage rights", ar: "أكد حقوق استخدام الخطوط والأصول" },
          { en: "Run export preflight before delivery", ar: "شغّل فحص ما قبل التصدير قبل التسليم" },
        ],
      };
    case "delivery.summary":
      return {
        kind: "summary",
        values: {
          assets: snapshot.assets.length,
          logos: brand.logos.variants.length,
          colors: brand.colors.tokens.length,
          fonts: brand.typography.fonts.length,
          textStyles: brand.typography.styles.length,
        },
      };
    default:
      return undefined;
  }
}
