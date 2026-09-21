import type { TextStyleToken } from "@/domain/brand/brand-system";
import type { GuidePage } from "@/domain/guide/guide-document";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import type { RenderedScene, RenderedTextLayer } from "@/editor/model/editor-types";
import { resolveRenderedScene } from "@/editor/scene/scene-resolver";

export interface ExportTextStyle {
  tokenId?: string;
  fontRefId?: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: number;
  fontStyle: "normal" | "italic" | "oblique";
  fill: string;
  features?: Readonly<Record<string, boolean>>;
}

export interface ExportScene {
  page: GuidePage;
  rendered: RenderedScene;
  textStyles: Readonly<Record<string, ExportTextStyle>>;
}

function tokenByRole(
  snapshot: ProjectSnapshot,
  layer: RenderedTextLayer,
): TextStyleToken | undefined {
  const styles = snapshot.project.brand.typography.styles;
  if (layer.source === "extra") {
    const source = layer.id;
    const extra = snapshot.project.guide.pageOrder
      .map((pageId) => snapshot.project.guide.pages[pageId])
      .flatMap((page) => page?.extras ?? [])
      .find((candidate) => candidate.id === source && candidate.type === "text");
    if (extra?.type === "text" && "tokenId" in extra.typography) {
      const tokenId = extra.typography.tokenId;
      if (typeof tokenId === "string") return styles.find((style) => style.id === tokenId);
    }
  }
  if (layer.name === "brand.name" || layer.name === "page.title") {
    return (
      styles.find((style) => style.role === "display") ??
      styles.find((style) => style.role === "h1")
    );
  }
  if (layer.name.includes("title") || layer.name.includes("heading")) {
    return (
      styles.find((style) => style.role === "h2") ?? styles.find((style) => style.role === "h1")
    );
  }
  return styles.find((style) => style.role === "body") ?? styles[0];
}

function resolveStyle(snapshot: ProjectSnapshot, layer: RenderedTextLayer): ExportTextStyle {
  const token = tokenByRole(snapshot, layer);
  const font = token
    ? snapshot.project.brand.typography.fonts.find((candidate) => candidate.id === token.fontRefId)
    : undefined;
  const color = token?.colorTokenId
    ? snapshot.project.brand.colors.tokens.find((candidate) => candidate.id === token.colorTokenId)
        ?.srgbHex
    : undefined;
  return {
    ...(token ? { tokenId: token.id, fontRefId: token.fontRefId } : {}),
    fontFamily: font?.familyName ?? "sans-serif",
    fontSize: token?.fontSize ?? 16,
    lineHeight: token?.lineHeight ?? Math.max(20, (token?.fontSize ?? 16) * 1.35),
    letterSpacing: token?.letterSpacing ?? 0,
    fontWeight: token?.fontWeight ?? font?.weight ?? 400,
    fontStyle: font?.style ?? "normal",
    fill: color ?? layer.fill,
    ...(token?.features ? { features: token.features } : {}),
  };
}

export function resolveExportScene(
  snapshot: ProjectSnapshot,
  page: GuidePage,
  localeMode: TemplateLocaleMode,
): ExportScene {
  const rendered = resolveRenderedScene(snapshot, page, localeMode);
  const textStyles: Record<string, ExportTextStyle> = {};
  for (const layer of rendered.layers) {
    if (layer.type === "text") textStyles[layer.id] = resolveStyle(snapshot, layer);
  }
  return { page, rendered, textStyles };
}
