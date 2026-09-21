import type { ArchiveEntry, ArchivePackager } from "@/application/ports/archive-packager";
import type { BinaryStore } from "@/application/ports/binary-store";
import {
  EXPORT_FIDELITY_CONTRACTS,
  type ExportArtifact,
  type ExportRenderer,
  type FontInclusionPolicy,
} from "@/domain/export/export-contract";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import { canonicalJson } from "@/infrastructure/archive/canonical-json";
import {
  buildBrandGuidelinesMarkdown,
  buildCssVariables,
  buildDesignTokensJson,
  buildStaticGuideCss,
  buildStaticIndexHtml,
} from "@/infrastructure/export/brand-artifact-builders";
import { slugifyFilename, utf8 } from "@/infrastructure/export/export-helpers";
import type { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";

export interface PackageExportOptions {
  localeMode: TemplateLocaleMode;
  fontPolicy: FontInclusionPolicy;
}

function titleForPage(
  snapshot: ProjectSnapshot,
  pageId: string,
  localeMode: TemplateLocaleMode,
): string {
  const page = snapshot.project.guide.pages[pageId];
  if (!page) return pageId;
  if (localeMode === "ar") return page.name.ar ?? page.name.en ?? page.semanticType;
  return page.name.en ?? page.name.ar ?? page.semanticType;
}

function internalAssetPath(
  kind: "asset" | "font",
  index: number,
  extension: string | undefined,
): string {
  const safeExtension = extension?.match(/^[a-z0-9]+$/)?.[0] ?? "bin";
  return `${kind === "font" ? "fonts" : "assets"}/${kind}-${String(index + 1).padStart(3, "0")}.${safeExtension}`;
}

export class WebGuideExportRenderer implements ExportRenderer<PackageExportOptions> {
  readonly format = "web-guide" as const;

  constructor(
    private readonly packager: ArchivePackager,
    private readonly outlinedSvg: SvgExportRenderer,
    private readonly binaries: BinaryStore,
  ) {}

  async render(
    snapshot: ProjectSnapshot,
    options: PackageExportOptions,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]> {
    const pageIds = snapshot.project.guide.pageOrder;
    const svgs = await this.outlinedSvg.render(
      snapshot,
      { localeMode: options.localeMode, pageIds },
      signal,
    );
    const entries: ArchiveEntry[] = [
      { path: "tokens.json", bytes: buildDesignTokensJson(snapshot) },
      { path: "variables.css", bytes: buildCssVariables(snapshot) },
      {
        path: "brand-guidelines.md",
        bytes: buildBrandGuidelinesMarkdown(snapshot, options.localeMode),
      },
      { path: "styles.css", bytes: buildStaticGuideCss() },
    ];

    const pages = svgs.map((artifact, index) => {
      const filename = `pages/page-${String(index + 1).padStart(3, "0")}.svg`;
      entries.push({ path: filename, bytes: artifact.bytes });
      return {
        filename,
        title: titleForPage(snapshot, pageIds[index] ?? "", options.localeMode),
      };
    });

    const fontCss = await this.addFonts(snapshot, options.fontPolicy, entries, signal);
    entries.push({
      path: "index.html",
      bytes: buildStaticIndexHtml(snapshot, options.localeMode, pages, fontCss),
    });
    entries.push({
      path: "README.txt",
      bytes: utf8(
        [
          "Hawya Studio static brand guide",
          "Rendered page artwork is outlined SVG and does not require fonts for visual fidelity.",
          `Font files: ${options.fontPolicy === "include-confirmed" ? "included by explicit user confirmation" : "omitted"}.`,
          "Color values are screen sRGB. This package is not a press-ready CMYK/PDF-X deliverable.",
          "",
        ].join("\n"),
      ),
    });

    const bytes = await this.packager.pack(entries, signal);
    return [
      {
        filename: `${slugifyFilename(snapshot.project.metadata.slug)}-web-guide.zip`,
        mime: "application/zip",
        bytes,
      },
    ];
  }

  private async addFonts(
    snapshot: ProjectSnapshot,
    policy: FontInclusionPolicy,
    entries: ArchiveEntry[],
    signal: AbortSignal,
  ): Promise<string> {
    if (policy !== "include-confirmed") return "";
    const assets = new Map(snapshot.assets.map((asset) => [asset.id, asset] as const));
    const rules: string[] = [];
    for (let index = 0; index < snapshot.project.brand.typography.fonts.length; index += 1) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const font = snapshot.project.brand.typography.fonts[index];
      if (!font) continue;
      const asset = assets.get(font.assetId);
      if (!asset) throw new Error(`Font asset ${font.assetId} is unavailable`);
      const binary = await this.binaries.get(asset.contentHash);
      if (!binary) throw new Error(`Font binary ${asset.contentHash} is unavailable`);
      const path = internalAssetPath("font", index, asset.extension);
      entries.push({ path, bytes: binary.bytes });
      rules.push(
        `@font-face{font-family:${JSON.stringify(font.familyName)};src:url("./${path}") format("woff2");font-style:${font.style ?? "normal"};font-weight:${font.weight ?? 400};font-display:swap}`,
      );
    }
    return rules.join("\n");
  }
}

export class DeliveryExportRenderer implements ExportRenderer<PackageExportOptions> {
  readonly format = "delivery" as const;

  constructor(
    private readonly packager: ArchivePackager,
    private readonly editableSvg: SvgExportRenderer,
    private readonly outlinedSvg: SvgExportRenderer,
    private readonly binaries: BinaryStore,
  ) {}

  async render(
    snapshot: ProjectSnapshot,
    options: PackageExportOptions,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]> {
    const pageIds = snapshot.project.guide.pageOrder;
    const [editable, outlined] = await Promise.all([
      this.editableSvg.render(snapshot, { localeMode: options.localeMode, pageIds }, signal),
      this.outlinedSvg.render(snapshot, { localeMode: options.localeMode, pageIds }, signal),
    ]);
    const entries: ArchiveEntry[] = [
      { path: "developer/tokens.json", bytes: buildDesignTokensJson(snapshot) },
      { path: "developer/variables.css", bytes: buildCssVariables(snapshot) },
      {
        path: "brand-guidelines.md",
        bytes: buildBrandGuidelinesMarkdown(snapshot, options.localeMode),
      },
    ];

    editable.forEach((artifact, index) => {
      entries.push({
        path: `artwork/editable/page-${String(index + 1).padStart(3, "0")}.svg`,
        bytes: artifact.bytes,
      });
    });
    outlined.forEach((artifact, index) => {
      entries.push({
        path: `artwork/outlined/page-${String(index + 1).padStart(3, "0")}.svg`,
        bytes: artifact.bytes,
      });
    });

    await this.addSourceAssets(snapshot, options.fontPolicy, entries, signal);
    entries.push({
      path: "manifest.json",
      bytes: utf8(
        canonicalJson({
          format: "hawya-delivery",
          formatVersion: 1,
          projectId: snapshot.project.id,
          projectSchemaVersion: snapshot.project.schemaVersion,
          localeMode: options.localeMode,
          fontPolicy: options.fontPolicy,
          fidelity: {
            editableSvg: EXPORT_FIDELITY_CONTRACTS["svg-editable"],
            outlinedSvg: EXPORT_FIDELITY_CONTRACTS["svg-outlined"],
            tokens: EXPORT_FIDELITY_CONTRACTS["tokens-json"],
            css: EXPORT_FIDELITY_CONTRACTS["css-variables"],
          },
        }),
      ),
    });
    entries.push({
      path: "README.txt",
      bytes: utf8(
        [
          "Hawya Studio delivery package",
          "Editable SVG keeps live text and therefore requires matching fonts on the receiving system.",
          "Outlined SVG preserves glyph geometry but text is no longer editable/searchable as text.",
          `Font files: ${options.fontPolicy === "include-confirmed" ? "included by explicit user confirmation" : "omitted"}.`,
          "CSS variables contain digital screen-sRGB values only.",
          "No Adobe Illustrator/InDesign native file is claimed or generated.",
          "",
        ].join("\n"),
      ),
    });

    const bytes = await this.packager.pack(entries, signal);
    return [
      {
        filename: `${slugifyFilename(snapshot.project.metadata.slug)}-delivery.zip`,
        mime: "application/zip",
        bytes,
      },
    ];
  }

  private async addSourceAssets(
    snapshot: ProjectSnapshot,
    fontPolicy: FontInclusionPolicy,
    entries: ArchiveEntry[],
    signal: AbortSignal,
  ): Promise<void> {
    const fonts = new Set(snapshot.project.brand.typography.fonts.map((font) => font.assetId));
    const referenced = new Set(snapshot.project.assetRefs.map((reference) => reference.assetId));
    const assets = snapshot.assets
      .filter((asset) => referenced.has(asset.id))
      .sort((left, right) => left.id.localeCompare(right.id));
    let sourceIndex = 0;
    let fontIndex = 0;
    for (const asset of assets) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const isFont = fonts.has(asset.id) || asset.kind === "font";
      if (isFont && fontPolicy !== "include-confirmed") continue;
      const binary = await this.binaries.get(asset.contentHash);
      if (!binary) throw new Error(`Asset binary ${asset.contentHash} is unavailable`);
      if (isFont) {
        entries.push({
          path: internalAssetPath("font", fontIndex, asset.extension),
          bytes: binary.bytes,
        });
        fontIndex += 1;
      } else {
        entries.push({
          path: internalAssetPath("asset", sourceIndex, asset.extension),
          bytes: binary.bytes,
        });
        sourceIndex += 1;
      }
    }
  }
}
