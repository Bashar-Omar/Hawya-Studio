import type { AssetId } from "@/domain/assets/asset";
import type { LocalizedString, Paint } from "@/domain/common/primitives";
import {
  resolveContentBinding,
  type ResolvedBindingValue,
} from "@/domain/guide/guide-binding-resolver";
import type { GuidePage, Layer } from "@/domain/guide/guide-document";
import { localizedValue } from "@/domain/guide/page-content";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import { templateById } from "@/domain/templates/template-engine";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import { findEditorOverride, templateSceneLayerId } from "@/editor/model/local-overrides";
import type {
  LayerTransform,
  RenderedGroupLayer,
  RenderedScene,
  RenderedSceneLayer,
  RenderedShapeLayer,
  RenderedTextLayer,
} from "@/editor/model/editor-types";

function paintColor(paint: Paint): string {
  return paint.type === "solid" ? paint.color : "transparent";
}

function localeText(value: LocalizedString, mode: TemplateLocaleMode): string {
  if (mode === "bilingual") {
    return [value.en, value.ar].filter(Boolean).join("\n");
  }
  return localizedValue(value, mode);
}

function textFromBinding(value: ResolvedBindingValue, mode: TemplateLocaleMode): string {
  if (value.kind === "localized-text") return localeText(value.value, mode);
  if (value.kind === "fonts") return value.fonts.map((font) => font.familyName).join(" · ");
  if (value.kind === "text-styles")
    return value.styles.map((style) => style.name || style.role).join(" · ");
  if (value.kind === "checklist")
    return value.items.map((item) => `• ${localeText(item, mode)}`).join("\n");
  if (value.kind === "summary") {
    const { assets, logos, colors, fonts, textStyles } = value.values;
    return `Assets ${assets} · Logos ${logos} · Colors ${colors} · Fonts ${fonts} · Styles ${textStyles}`;
  }
  if (value.kind === "rule") return JSON.stringify(value.value, null, 2);
  if (value.kind === "colors")
    return value.tokens
      .map((token) => `${token.name.en ?? token.name.ar ?? token.role} ${token.srgbHex}`)
      .join("\n");
  if (value.kind === "logos")
    return value.variants
      .map((variant) => variant.name.en ?? variant.name.ar ?? variant.role)
      .join(" · ");
  if (value.kind === "assets") return value.assets.map((asset) => asset.name).join(" · ");
  return "";
}

function assetFromBinding(value: ResolvedBindingValue | undefined): AssetId | undefined {
  if (!value) return undefined;
  if (value.kind === "logos") return value.variants[0]?.assetId;
  if (value.kind === "assets") return value.assets[0]?.id;
  return undefined;
}

function templateTransform(
  page: GuidePage,
  rect: { x: number; y: number; width: number; height: number },
): LayerTransform {
  return {
    x: (rect.x / 100) * page.canvas.width,
    y: (rect.y / 100) * page.canvas.height,
    width: (rect.width / 100) * page.canvas.width,
    height: (rect.height / 100) * page.canvas.height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

function templateLayer(
  snapshot: ProjectSnapshot,
  page: GuidePage,
  slot: NonNullable<ReturnType<typeof templateById>>["slots"][number],
  index: number,
  mode: TemplateLocaleMode,
): RenderedSceneLayer {
  const id = templateSceneLayerId(slot.id);
  const binding = page.templateBinding.slotBindings[slot.id];
  const value = binding ? resolveContentBinding(snapshot, page, binding) : undefined;
  const override = findEditorOverride(page, id);
  const transform = override?.transform ?? templateTransform(page, slot.rect);
  const base = {
    id,
    name: slot.role,
    source: "template" as const,
    visible: override?.visible ?? true,
    locked: override?.locked ?? false,
    opacity: 1,
    transform,
    zIndex: index,
  };
  const assetId = assetFromBinding(value);
  if (assetId && slot.contentKinds.some((kind) => kind === "logo" || kind === "assets")) {
    return { ...base, type: "image", assetId, fit: "contain" };
  }
  if (value?.kind === "colors") {
    return {
      ...base,
      type: "shape",
      shape: "rect",
      fill: value.tokens[0]?.srgbHex ?? "#F2F2F2",
      palette: value.tokens.map((token) => token.srgbHex),
    };
  }
  return {
    ...base,
    type: "text",
    text: override?.text ?? (value ? textFromBinding(value, mode) : "Needs input"),
    direction: mode === "ar" ? "rtl" : mode === "en" ? "ltr" : "auto",
    alignment: mode === "ar" ? "end" : "start",
    fill: "#111111",
  };
}

function resolvedColor(snapshot: ProjectSnapshot, layer: Extract<Layer, { type: "text" }>): string {
  const fill = layer.fill;
  if ("colorTokenId" in fill) {
    const tokenId = fill.colorTokenId;
    return (
      snapshot.project.brand.colors.tokens.find((token) => token.id === tokenId)?.srgbHex ??
      "#111111"
    );
  }
  return paintColor(fill);
}

function extraLayer(snapshot: ProjectSnapshot, layer: Layer, index: number): RenderedSceneLayer {
  const base = {
    id: layer.id,
    name: layer.name,
    source: "extra" as const,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    transform: layer.transform,
    zIndex: 10_000 + index,
    ...(layer.parentGroupId ? { parentGroupId: layer.parentGroupId } : {}),
  };
  if (layer.type === "text") {
    return {
      ...base,
      type: "text",
      text: typeof layer.content === "string" ? layer.content : layer.content.binding,
      direction: layer.direction,
      ...(layer.language ? { language: layer.language } : {}),
      alignment: layer.alignment,
      fill: resolvedColor(snapshot, layer),
    } satisfies RenderedTextLayer;
  }
  if (layer.type === "image") {
    return {
      ...base,
      type: "image",
      assetId: layer.assetId,
      fit: layer.fit,
      ...(layer.crop ? { crop: layer.crop } : {}),
      ...(layer.cornerRadius !== undefined ? { cornerRadius: layer.cornerRadius } : {}),
    };
  }
  if (layer.type === "group") {
    const childIds = Array.isArray(layer.data.childIds)
      ? layer.data.childIds.filter(
          (candidate): candidate is string => typeof candidate === "string",
        )
      : [];
    return { ...base, type: "group", childIds } satisfies RenderedGroupLayer;
  }
  if (layer.type === "vector") {
    const assetId =
      typeof layer.data.assetId === "string" ? (layer.data.assetId as AssetId) : undefined;
    return { ...base, type: "vector", ...(assetId ? { assetId } : {}) };
  }
  const shape =
    layer.data.shape === "ellipse" || layer.data.shape === "line" ? layer.data.shape : "rect";
  const fill = typeof layer.data.fill === "string" ? layer.data.fill : "#D9DDE7";
  const stroke = typeof layer.data.stroke === "string" ? layer.data.stroke : undefined;
  const strokeWidth =
    typeof layer.data.strokeWidth === "number" ? layer.data.strokeWidth : undefined;
  const radius = typeof layer.data.radius === "number" ? layer.data.radius : undefined;
  return {
    ...base,
    type: "shape",
    shape,
    fill,
    ...(stroke ? { stroke } : {}),
    ...(strokeWidth !== undefined ? { strokeWidth } : {}),
    ...(radius !== undefined ? { radius } : {}),
  } satisfies RenderedShapeLayer;
}

export function resolveRenderedScene(
  snapshot: ProjectSnapshot,
  page: GuidePage,
  localeMode: TemplateLocaleMode,
): RenderedScene {
  const template = templateById(page.templateBinding.templateId);
  const templateLayers =
    template?.slots.map((slot, index) => templateLayer(snapshot, page, slot, index, localeMode)) ??
    [];
  const extras = page.extras.map((layer, index) => extraLayer(snapshot, layer, index));
  return {
    pageWidth: page.canvas.width,
    pageHeight: page.canvas.height,
    background: page.canvas.background,
    layers: [...templateLayers, ...extras],
  };
}
