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
  buildStaticDeploymentReadme,
  buildStaticGuideCss,
  buildStaticIndexHtml,
  buildWebGuideDataJson,
  type StaticGuideAssetFile,
} from "@/infrastructure/export/brand-artifact-builders";
import { slugifyFilename, utf8 } from "@/infrastructure/export/export-helpers";
import type { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";

export interface PackageExportOptions {
  localeMode: TemplateLocaleMode;
  fontPolicy: FontInclusionPolicy;
}

export interface DeliverySelection {
  guidelines: boolean;
  artwork: boolean;
  logos: boolean;
  colors: boolean;
  digital: boolean;
  fonts: boolean;
  sourceAttachments: boolean;
}

export const DEFAULT_DELIVERY_SELECTION: DeliverySelection = {
  guidelines: true,
  artwork: true,
  logos: true,
  colors: true,
  digital: true,
  fonts: false,
  sourceAttachments: false,
};

export interface DeliveryExportOptions extends PackageExportOptions {
  include: DeliverySelection;
  exportedAt: string;
  appVersion: string;
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

function safeExtension(extension: string | undefined): string {
  return extension?.toLowerCase().match(/^[a-z0-9]{1,8}$/)?.[0] ?? "bin";
}

function internalAssetPath(
  kind: "asset" | "font",
  index: number,
  extension: string | undefined,
): string {
  return `${kind === "font" ? "fonts" : "assets"}/${kind}-${String(index + 1).padStart(3, "0")}.${safeExtension(extension)}`;
}

function cssFontFormat(extension: string | undefined): string | undefined {
  if (extension === "woff2") return "woff2";
  if (extension === "woff") return "woff";
  if (extension === "ttf") return "truetype";
  if (extension === "otf") return "opentype";
  return undefined;
}

async function loadBinary(
  binaries: BinaryStore,
  contentHash: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  const binary = await binaries.get(contentHash);
  if (!binary) throw new Error(`Asset binary ${contentHash} is unavailable`);
  return binary.bytes;
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
      { path: "data/brand.json", bytes: buildWebGuideDataJson(snapshot) },
      { path: "data/tokens.json", bytes: buildDesignTokensJson(snapshot) },
      {
        path: "brand-guidelines.md",
        bytes: buildBrandGuidelinesMarkdown(snapshot, options.localeMode),
      },
      { path: "DEPLOY.md", bytes: buildStaticDeploymentReadme(snapshot) },
    ];

    const pages = svgs.map((artifact, index) => {
      const filename = `assets/pages/page-${String(index + 1).padStart(3, "0")}.svg`;
      entries.push({ path: filename, bytes: artifact.bytes });
      return {
        filename,
        title: titleForPage(snapshot, pageIds[index] ?? "", options.localeMode),
      };
    });

    const assetFiles = await this.addAssets(snapshot, entries, signal);
    const fontCss = await this.addFonts(snapshot, options.fontPolicy, entries, signal);
    const baseCss = new TextDecoder().decode(buildStaticGuideCss());
    entries.push({
      path: "styles.css",
      bytes: utf8(`${baseCss}\n${fontCss}\n`),
    });
    entries.push({
      path: "index.html",
      bytes: buildStaticIndexHtml(snapshot, options.localeMode, pages, assetFiles),
    });
    entries.push({
      path: "README.txt",
      bytes: utf8(
        [
          "Hawya Studio static brand guide",
          "Responsive semantic guide with an optional fixed-page presentation appendix.",
          "No Hawya API, editing runtime, account, analytics, or hosted backend is required.",
          `Font files: ${options.fontPolicy === "include-confirmed" ? "included by explicit user confirmation" : "omitted"}.`,
          "Color values are screen sRGB. This package is not a press-ready CMYK/PDF-X deliverable.",
          "See DEPLOY.md for static-host instructions.",
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

  private async addAssets(
    snapshot: ProjectSnapshot,
    entries: ArchiveEntry[],
    signal: AbortSignal,
  ): Promise<StaticGuideAssetFile[]> {
    const fontIds = new Set(snapshot.project.brand.typography.fonts.map((font) => font.assetId));
    const referenced = new Set(snapshot.project.assetRefs.map((reference) => reference.assetId));
    const seenHashes = new Map<string, string>();
    const files: StaticGuideAssetFile[] = [];
    let index = 0;

    for (const asset of snapshot.assets
      .filter((candidate) => referenced.has(candidate.id) && !fontIds.has(candidate.id))
      .sort((left, right) => left.id.localeCompare(right.id))) {
      let path = seenHashes.get(asset.contentHash);
      if (!path) {
        path = internalAssetPath("asset", index, asset.extension);
        index += 1;
        entries.push({
          path,
          bytes: await loadBinary(this.binaries, asset.contentHash, signal),
        });
        seenHashes.set(asset.contentHash, path);
      }
      files.push({
        assetId: asset.id,
        filename: path,
        alt: asset.originalFilename,
      });
    }
    return files;
  }

  private async addFonts(
    snapshot: ProjectSnapshot,
    policy: FontInclusionPolicy,
    entries: ArchiveEntry[],
    signal: AbortSignal,
  ): Promise<string> {
    if (policy !== "include-confirmed") return "";
    const assets = new Map(snapshot.assets.map((asset) => [asset.id, asset] as const));
    const seenHashes = new Map<string, string>();
    const rules: string[] = [];
    let fileIndex = 0;

    for (const font of snapshot.project.brand.typography.fonts) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const asset = assets.get(font.assetId);
      if (!asset) throw new Error(`Font asset ${font.assetId} is unavailable`);
      let path = seenHashes.get(asset.contentHash);
      if (!path) {
        path = internalAssetPath("font", fileIndex, asset.extension);
        fileIndex += 1;
        entries.push({
          path,
          bytes: await loadBinary(this.binaries, asset.contentHash, signal),
        });
        seenHashes.set(asset.contentHash, path);
      }
      const format = cssFontFormat(asset.extension);
      rules.push(
        `@font-face{font-family:${JSON.stringify(font.familyName)};src:url("./${path}")${format ? ` format("${format}")` : ""};font-style:${font.style ?? "normal"};font-weight:${font.weight ?? 400};font-display:swap}`,
      );
    }
    return rules.join("\n");
  }
}

export class DeliveryExportRenderer implements ExportRenderer<DeliveryExportOptions> {
  readonly format = "delivery" as const;

  constructor(
    private readonly packager: ArchivePackager,
    private readonly editableSvg: SvgExportRenderer,
    private readonly outlinedSvg: SvgExportRenderer,
    private readonly binaries: BinaryStore,
  ) {}

  async render(
    snapshot: ProjectSnapshot,
    options: DeliveryExportOptions,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]> {
    const entries: ArchiveEntry[] = [];
    const pageIds = snapshot.project.guide.pageOrder;

    if (options.include.guidelines) {
      entries.push({
        path: "Guidelines/Brand-Guidelines.md",
        bytes: buildBrandGuidelinesMarkdown(snapshot, options.localeMode),
      });
    }

    if (options.include.colors) {
      entries.push({
        path: "Colors/brand-tokens.json",
        bytes: buildDesignTokensJson(snapshot),
      });
    }

    if (options.include.digital) {
      entries.push(
        { path: "Digital/brand.css", bytes: buildCssVariables(snapshot) },
        { path: "Digital/tokens.json", bytes: buildDesignTokensJson(snapshot) },
      );
    }

    if (options.include.artwork) {
      const [editable, outlined] = await Promise.all([
        this.editableSvg.render(snapshot, { localeMode: options.localeMode, pageIds }, signal),
        this.outlinedSvg.render(snapshot, { localeMode: options.localeMode, pageIds }, signal),
      ]);
      editable.forEach((artifact, index) => {
        entries.push({
          path: `Artwork/Editable/page-${String(index + 1).padStart(3, "0")}.svg`,
          bytes: artifact.bytes,
        });
      });
      outlined.forEach((artifact, index) => {
        entries.push({
          path: `Artwork/Outlined/page-${String(index + 1).padStart(3, "0")}.svg`,
          bytes: artifact.bytes,
        });
      });
    }

    const addedHashes = new Set<string>();
    if (options.include.logos) {
      await this.addLogoAssets(snapshot, entries, addedHashes, signal);
    }
    if (options.include.fonts && options.fontPolicy === "include-confirmed") {
      await this.addFonts(snapshot, entries, addedHashes, signal);
    }
    if (options.include.sourceAttachments) {
      await this.addSourceAttachments(snapshot, entries, addedHashes, signal);
    }

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
          include: options.include,
          exportedAt: options.exportedAt,
          hawyaVersion: options.appVersion,
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
          `Hawya Studio delivery package — ${snapshot.project.metadata.name}`,
          `Hawya Studio version: ${options.appVersion}`,
          `Exported at: ${options.exportedAt}`,
          `Project schema: ${snapshot.project.schemaVersion}`,
          "",
          "Editable SVG keeps live text and therefore requires matching fonts on the receiving system.",
          "Outlined SVG preserves glyph geometry but text is no longer editable/searchable as text.",
          `Font files: ${options.include.fonts && options.fontPolicy === "include-confirmed" ? "included by explicit user confirmation" : "omitted"}.`,
          "CSS variables contain digital screen-sRGB values only.",
          "Print color metadata, when present in tokens, is distinct from digital CSS values.",
          "No Adobe Illustrator/InDesign native file or PDF/X file is claimed or generated.",
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

  private async addLogoAssets(
    snapshot: ProjectSnapshot,
    entries: ArchiveEntry[],
    addedHashes: Set<string>,
    signal: AbortSignal,
  ): Promise<void> {
    const assets = new Map(snapshot.assets.map((asset) => [asset.id, asset] as const));
    let index = 0;
    for (const variant of snapshot.project.brand.logos.variants) {
      const asset = assets.get(variant.assetId);
      if (!asset || addedHashes.has(asset.contentHash)) continue;
      if (asset.mime !== "image/svg+xml" && asset.extension !== "svg") continue;
      entries.push({
        path: `Logos/SVG/logo-${String(index + 1).padStart(3, "0")}.svg`,
        bytes: await loadBinary(this.binaries, asset.contentHash, signal),
      });
      index += 1;
      addedHashes.add(asset.contentHash);
    }
  }

  private async addFonts(
    snapshot: ProjectSnapshot,
    entries: ArchiveEntry[],
    addedHashes: Set<string>,
    signal: AbortSignal,
  ): Promise<void> {
    const assets = new Map(snapshot.assets.map((asset) => [asset.id, asset] as const));
    let index = 0;
    for (const font of snapshot.project.brand.typography.fonts) {
      const asset = assets.get(font.assetId);
      if (!asset || addedHashes.has(asset.contentHash)) continue;
      entries.push({
        path: `Fonts/font-${String(index + 1).padStart(3, "0")}.${safeExtension(asset.extension)}`,
        bytes: await loadBinary(this.binaries, asset.contentHash, signal),
      });
      index += 1;
      addedHashes.add(asset.contentHash);
    }
  }

  private async addSourceAttachments(
    snapshot: ProjectSnapshot,
    entries: ArchiveEntry[],
    addedHashes: Set<string>,
    signal: AbortSignal,
  ): Promise<void> {
    const referenced = new Set(snapshot.project.assetRefs.map((reference) => reference.assetId));
    let index = 0;
    for (const asset of snapshot.assets
      .filter((candidate) => referenced.has(candidate.id) && candidate.kind !== "font")
      .sort((left, right) => left.id.localeCompare(right.id))) {
      if (addedHashes.has(asset.contentHash)) continue;
      entries.push({
        path: `Source-Attachments/asset-${String(index + 1).padStart(3, "0")}.${safeExtension(asset.extension)}`,
        bytes: await loadBinary(this.binaries, asset.contentHash, signal),
      });
      index += 1;
      addedHashes.add(asset.contentHash);
    }
  }
}
