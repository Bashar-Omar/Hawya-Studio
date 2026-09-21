import type { BinaryStore } from "@/application/ports/binary-store";
import type { FontOutliner } from "@/application/ports/font-outliner";
import type { ExportArtifact, ExportRenderer } from "@/domain/export/export-contract";
import { resolveExportScene, type ExportTextStyle } from "@/domain/export/export-scene";
import type { GuidePage } from "@/domain/guide/guide-document";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import type {
  LayerTransform,
  RenderedSceneLayer,
  RenderedTextLayer,
} from "@/editor/model/editor-types";
import { dataUri, escapeXml, slugifyFilename, utf8 } from "@/infrastructure/export/export-helpers";

export interface SvgExportOptions {
  localeMode: TemplateLocaleMode;
  pageIds?: readonly string[];
}

type AssetMap = ReadonlyMap<string, { mime: string; bytes: Uint8Array }>;

function transformAttribute(transform: LayerTransform): string {
  const cx = transform.x + transform.width / 2;
  const cy = transform.y + transform.height / 2;
  return `translate(${cx} ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX} ${transform.scaleY}) translate(${-transform.width / 2} ${-transform.height / 2})`;
}

function preserveAspect(fit: "cover" | "contain" | "fill"): string {
  if (fit === "fill") return "none";
  return `xMidYMid ${fit === "cover" ? "slice" : "meet"}`;
}

function layerOpen(layer: RenderedSceneLayer): string {
  return `<g data-layer-id="${escapeXml(layer.id)}" opacity="${layer.opacity}" transform="${transformAttribute(layer.transform)}">`;
}

function shapeMarkup(layer: Extract<RenderedSceneLayer, { type: "shape" }>): string {
  const { width, height } = layer.transform;
  if (layer.palette?.length) {
    const band = width / layer.palette.length;
    return layer.palette
      .map(
        (color, index) =>
          `<rect x="${band * index}" y="0" width="${band + 0.01}" height="${height}" fill="${escapeXml(color)}"/>`,
      )
      .join("");
  }
  if (layer.shape === "ellipse")
    return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${escapeXml(layer.fill)}"${layer.stroke ? ` stroke="${escapeXml(layer.stroke)}" stroke-width="${layer.strokeWidth ?? 1}"` : ""}/>`;
  if (layer.shape === "line")
    return `<line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="${escapeXml(layer.stroke ?? layer.fill)}" stroke-width="${layer.strokeWidth ?? Math.max(1, height)}"/>`;
  return `<rect width="${width}" height="${height}"${layer.radius ? ` rx="${layer.radius}" ry="${layer.radius}"` : ""} fill="${escapeXml(layer.fill)}"${layer.stroke ? ` stroke="${escapeXml(layer.stroke)}" stroke-width="${layer.strokeWidth ?? 1}"` : ""}/>`;
}

function editableTextMarkup(layer: RenderedTextLayer, style: ExportTextStyle): string {
  const anchor =
    layer.alignment === "center" ? "middle" : layer.alignment === "end" ? "end" : "start";
  const x =
    anchor === "middle" ? layer.transform.width / 2 : anchor === "end" ? layer.transform.width : 0;
  const lines = layer.text.split("\n");
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? style.fontSize : style.lineHeight}">${escapeXml(line || " ")}</tspan>`,
    )
    .join("");
  return `<text x="${x}" y="0" dominant-baseline="hanging" text-anchor="${anchor}" direction="${layer.direction}" font-family="${escapeXml(style.fontFamily)}" font-size="${style.fontSize}" font-weight="${style.fontWeight}" font-style="${style.fontStyle}" letter-spacing="${style.letterSpacing}" fill="${escapeXml(style.fill)}">${tspans}</text>`;
}

async function outlinedTextMarkup(
  layer: RenderedTextLayer,
  style: ExportTextStyle,
  fontBytes: Uint8Array,
  outliner: FontOutliner,
  signal: AbortSignal,
): Promise<string> {
  const lines = layer.text.split("\n");
  const rows: string[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex] ?? "";
    const outline = await outliner.outline(
      fontBytes,
      text || " ",
      {
        fontSize: style.fontSize,
        letterSpacing: style.letterSpacing,
        ...(style.features ? { features: style.features } : {}),
      },
      signal,
    );
    const scale = style.fontSize / outline.unitsPerEm;
    const renderedWidth = outline.advanceWidth * scale;
    const xOffset =
      layer.alignment === "center"
        ? (layer.transform.width - renderedWidth) / 2
        : layer.alignment === "end"
          ? layer.transform.width - renderedWidth
          : 0;
    const baseline = lineIndex * style.lineHeight + outline.ascent * scale;
    for (const glyph of outline.glyphs) {
      const x = xOffset + glyph.x * scale;
      const y = baseline - glyph.y * scale;
      rows.push(
        `<path d="${escapeXml(glyph.pathData)}" transform="translate(${x} ${y}) scale(${scale} ${-scale})" fill="${escapeXml(style.fill)}"/>`,
      );
    }
  }
  return rows.join("");
}

export class SvgExportRenderer implements ExportRenderer<SvgExportOptions> {
  readonly format: "svg-editable" | "svg-outlined";

  constructor(
    private readonly binaries: BinaryStore,
    private readonly outliner: FontOutliner,
    private readonly mode: "editable" | "outlined",
  ) {
    this.format = mode === "editable" ? "svg-editable" : "svg-outlined";
  }

  async render(
    snapshot: ProjectSnapshot,
    options: SvgExportOptions,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]> {
    const pageIds = options.pageIds ?? snapshot.project.guide.pageOrder;
    const assets = await this.loadAssets(snapshot, signal);
    const fontBytesByRef = this.fontBytes(snapshot, assets);
    const artifacts: ExportArtifact[] = [];
    for (const pageId of pageIds) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const page = snapshot.project.guide.pages[pageId];
      if (!page) throw new Error(`Export page ${pageId} is missing`);
      const svg = await this.renderPage(snapshot, page, options, assets, fontBytesByRef, signal);
      artifacts.push({
        filename: `${slugifyFilename(snapshot.project.metadata.name)}-${slugifyFilename(page.name.en ?? page.name.ar ?? page.semanticType)}${this.mode === "outlined" ? "-outlined" : ""}.svg`,
        mime: "image/svg+xml",
        bytes: utf8(svg),
      });
    }
    return artifacts;
  }

  private async loadAssets(snapshot: ProjectSnapshot, signal: AbortSignal): Promise<AssetMap> {
    const entries: Array<[string, { mime: string; bytes: Uint8Array }]> = [];
    for (const asset of snapshot.assets) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const binary = await this.binaries.get(asset.contentHash);
      if (binary)
        entries.push([asset.id, { mime: binary.mime || asset.mime, bytes: binary.bytes }]);
    }
    return new Map(entries);
  }

  private fontBytes(snapshot: ProjectSnapshot, assets: AssetMap): ReadonlyMap<string, Uint8Array> {
    const result = new Map<string, Uint8Array>();
    for (const font of snapshot.project.brand.typography.fonts) {
      const bytes = assets.get(font.assetId)?.bytes;
      if (bytes) result.set(font.id, bytes);
    }
    return result;
  }

  private async renderPage(
    snapshot: ProjectSnapshot,
    page: GuidePage,
    options: SvgExportOptions,
    assets: AssetMap,
    fonts: ReadonlyMap<string, Uint8Array>,
    signal: AbortSignal,
  ): Promise<string> {
    const scene = resolveExportScene(snapshot, page, options.localeMode);
    const content: string[] = [];
    if (scene.rendered.background.type === "solid")
      content.push(
        `<rect width="100%" height="100%" fill="${escapeXml(scene.rendered.background.color)}" fill-opacity="${scene.rendered.background.alpha}"/>`,
      );
    const sorted = [...scene.rendered.layers]
      .filter((layer) => layer.visible)
      .sort((left, right) => left.zIndex - right.zIndex);
    const layersById = new Map(sorted.map((layer) => [layer.id, layer] as const));

    const renderLayer = async (layer: RenderedSceneLayer): Promise<string> => {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");

      if (layer.type === "group") {
        const children = layer.childIds
          .map((id) => layersById.get(id))
          .filter((child): child is RenderedSceneLayer => Boolean(child))
          .sort((left, right) => left.zIndex - right.zIndex);
        const body: string[] = [];
        for (const child of children) body.push(await renderLayer(child));
        return `${layerOpen(layer)}${body.join("")}</g>`;
      }

      let body = "";
      if (layer.type === "shape") {
        body = shapeMarkup(layer);
      } else if (layer.type === "image" || layer.type === "vector") {
        const asset = layer.assetId ? assets.get(layer.assetId) : undefined;
        if (!asset) {
          throw new Error(`Asset ${layer.assetId ?? "unknown"} is unavailable during SVG export`);
        }
        const fit = layer.type === "image" ? layer.fit : "contain";
        body = `<image width="${layer.transform.width}" height="${layer.transform.height}" href="${dataUri(asset.mime, asset.bytes)}" preserveAspectRatio="${preserveAspect(fit)}"/>`;
      } else if (layer.type === "text") {
        const style = scene.textStyles[layer.id];
        if (!style) throw new Error(`Text style for layer ${layer.id} is unavailable`);
        if (this.mode === "editable") {
          body = editableTextMarkup(layer, style);
        } else {
          const fontBytes = style.fontRefId ? fonts.get(style.fontRefId) : undefined;
          if (!fontBytes) {
            throw new Error(`Font binary for text layer ${layer.id} is unavailable`);
          }
          body = await outlinedTextMarkup(layer, style, fontBytes, this.outliner, signal);
        }
      }
      return `${layerOpen(layer)}${body}</g>`;
    };

    for (const layer of sorted.filter((candidate) => !candidate.parentGroupId)) {
      content.push(await renderLayer(layer));
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.rendered.pageWidth}" height="${scene.rendered.pageHeight}" viewBox="0 0 ${scene.rendered.pageWidth} ${scene.rendered.pageHeight}" data-hawya-export="${this.mode}"><title>${escapeXml(page.name.en ?? page.name.ar ?? page.semanticType)}</title>${content.join("")}</svg>`;
  }
}
