import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import { canonicalJson } from "@/infrastructure/archive/canonical-json";
import { escapeHtml, escapeXml, utf8 } from "@/infrastructure/export/export-helpers";

type Locale = "en" | "ar";

export interface StaticGuideAssetFile {
  assetId: string;
  filename: string;
  alt: string;
}

function localized(
  value: Partial<Record<Locale, string | undefined>> | undefined,
  locale: Locale,
): string | undefined {
  if (!value) return undefined;
  return value[locale] ?? value[locale === "en" ? "ar" : "en"];
}

function localeList(mode: TemplateLocaleMode): readonly Locale[] {
  return mode === "bilingual" ? ["en", "ar"] : [mode];
}

function suffix(id: string): string {
  return id.replaceAll("-", "").slice(0, 8).toLowerCase();
}

function cssQuoted(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function safeAssetFilename(index: number, extension: string | undefined): string {
  const safeExtension = extension?.toLowerCase().match(/^[a-z0-9]{1,8}$/)?.[0] ?? "bin";
  return `assets/asset-${String(index + 1).padStart(3, "0")}.${safeExtension}`;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function projectAssetMap(snapshot: ProjectSnapshot) {
  const referenced = new Set(snapshot.project.assetRefs.map((reference) => reference.assetId));
  return snapshot.assets
    .filter((asset) => referenced.has(asset.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((asset, index) => ({
      id: asset.id,
      kind: asset.kind,
      mime: asset.mime,
      byteLength: asset.byteLength,
      filename: safeAssetFilename(index, asset.extension),
      sourceName: asset.originalFilename,
      contentHash: asset.contentHash,
    }));
}

export function buildDesignTokensJson(snapshot: ProjectSnapshot): Uint8Array {
  const fontsById = new Map(
    snapshot.project.brand.typography.fonts.map((font) => [font.id, font] as const),
  );
  const colors = [...snapshot.project.brand.colors.tokens]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((token) => ({
      id: token.id,
      name: token.name,
      role: token.role,
      srgb: token.srgbHex.toUpperCase(),
      alpha: token.alpha,
      rgb: token.rgb,
      provenance: { projectTokenId: token.id },
      ...(token.oklch ? { oklch: token.oklch } : {}),
      ...(token.hsl ? { hsl: token.hsl } : {}),
      ...(token.print ? { print: token.print } : {}),
    }));
  const typography = [...snapshot.project.brand.typography.styles]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((style) => {
      const font = fontsById.get(style.fontRefId);
      return {
        id: style.id,
        name: style.name,
        role: style.role,
        font: {
          refId: style.fontRefId,
          family: font?.familyName ?? null,
          ...(font?.weight ? { sourceWeight: font.weight } : {}),
          ...(font?.style ? { sourceStyle: font.style } : {}),
          ...(font?.variableAxes ? { variableAxes: font.variableAxes } : {}),
        },
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        fontWeight: style.fontWeight ?? font?.weight ?? 400,
        direction: style.direction,
        ...(style.language ? { language: style.language } : {}),
        ...(style.colorTokenId ? { colorTokenId: style.colorTokenId } : {}),
        ...(style.features ? { features: style.features } : {}),
      };
    });

  return utf8(
    canonicalJson({
      format: "hawya-brand-tokens",
      formatVersion: 1,
      projectSchemaVersion: snapshot.project.schemaVersion,
      project: {
        id: snapshot.project.id,
        name: snapshot.project.metadata.name,
        slug: snapshot.project.metadata.slug,
      },
      locales: {
        default: snapshot.project.settings.defaultContentLocale,
        enabled: [...snapshot.project.settings.enabledContentLocales],
        guideMode:
          snapshot.project.settings.guideLocaleMode ??
          snapshot.project.settings.defaultContentLocale,
      },
      assets: projectAssetMap(snapshot),
      brand: {
        name: snapshot.project.brand.identity.brandName,
        ...(snapshot.project.brand.identity.descriptor
          ? { descriptor: snapshot.project.brand.identity.descriptor }
          : {}),
        colors,
        typography,
        ...(snapshot.project.brand.digital ? { digital: snapshot.project.brand.digital } : {}),
      },
    }),
  );
}

export function buildWebGuideDataJson(snapshot: ProjectSnapshot): Uint8Array {
  return utf8(
    canonicalJson({
      format: "hawya-web-guide-data",
      formatVersion: 1,
      projectSchemaVersion: snapshot.project.schemaVersion,
      project: {
        id: snapshot.project.id,
        name: snapshot.project.metadata.name,
      },
      locales: {
        default: snapshot.project.settings.defaultContentLocale,
        enabled: [...snapshot.project.settings.enabledContentLocales],
      },
      identity: snapshot.project.brand.identity,
      logos: snapshot.project.brand.logos,
      colors: snapshot.project.brand.colors,
      typography: snapshot.project.brand.typography,
      assets: projectAssetMap(snapshot),
    }),
  );
}

export function buildCssVariables(snapshot: ProjectSnapshot): Uint8Array {
  const fontsById = new Map(
    snapshot.project.brand.typography.fonts.map((font) => [font.id, font] as const),
  );
  const lines = ["/* Hawya Studio digital tokens · sRGB / screen values only */", ":root {"];

  for (const token of [...snapshot.project.brand.colors.tokens].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    lines.push(
      `  --hawya-color-${token.role}-${suffix(token.id)}: ${token.srgbHex.toUpperCase()};`,
    );
    lines.push(`  --hawya-color-${token.role}-${suffix(token.id)}-alpha: ${token.alpha};`);
  }

  for (const style of [...snapshot.project.brand.typography.styles].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const font = fontsById.get(style.fontRefId);
    const key = `${style.role}-${suffix(style.id)}`;
    lines.push(`  --hawya-type-${key}-family: ${cssQuoted(font?.familyName ?? "sans-serif")};`);
    lines.push(`  --hawya-type-${key}-size: ${style.fontSize}px;`);
    lines.push(`  --hawya-type-${key}-line-height: ${style.lineHeight}px;`);
    lines.push(`  --hawya-type-${key}-letter-spacing: ${style.letterSpacing}px;`);
    lines.push(`  --hawya-type-${key}-weight: ${style.fontWeight ?? font?.weight ?? 400};`);
  }

  lines.push("}", "");
  return utf8(lines.join("\n"));
}

function heading(locale: Locale, en: string, ar: string): string {
  return locale === "ar" ? ar : en;
}

function markdownForLocale(snapshot: ProjectSnapshot, locale: Locale): string {
  const identity = snapshot.project.brand.identity;
  const languageLabel = locale === "ar" ? "العربية" : "English";
  const brandName = localized(identity.brandName, locale) ?? snapshot.project.metadata.name;
  const lines = [`## ${languageLabel}`, "", `# ${brandName}`, ""];

  const descriptor = localized(identity.descriptor, locale);
  if (descriptor) lines.push(descriptor, "");
  const story = localized(identity.story, locale);
  if (story) lines.push(`### ${heading(locale, "Story", "القصة")}`, "", story, "");
  const mission = localized(identity.mission, locale);
  if (mission) lines.push(`### ${heading(locale, "Mission", "الرسالة")}`, "", mission, "");
  const vision = localized(identity.vision, locale);
  if (vision) lines.push(`### ${heading(locale, "Vision", "الرؤية")}`, "", vision, "");

  if (identity.values.length) {
    lines.push(`### ${heading(locale, "Values", "القيم")}`, "");
    for (const value of identity.values) {
      const name = localized(value.name, locale);
      if (!name) continue;
      const description = localized(value.description, locale);
      lines.push(`- **${name}**${description ? `: ${description}` : ""}`);
    }
    lines.push("");
  }

  if (snapshot.project.brand.logos.variants.length) {
    lines.push(`### ${heading(locale, "Logo system", "نظام الشعار")}`, "");
    for (const variant of snapshot.project.brand.logos.variants) {
      lines.push(
        `- **${localized(variant.name, locale) ?? variant.role}** — ${variant.role} — asset \`${variant.assetId}\``,
      );
    }
    const rules = snapshot.project.brand.logos.rules;
    if (rules.clearSpace) {
      lines.push(
        `- ${heading(locale, "Clear-space rule source", "مصدر قاعدة المساحة الآمنة")}: **${rules.clearSpace.source}**`,
      );
    }
    if (rules.minimumSize) {
      lines.push(
        `- ${heading(locale, "Minimum-size rule source", "مصدر قاعدة الحد الأدنى للحجم")}: **${rules.minimumSize.source}**`,
      );
    }
    if (rules.incorrectUsage.length) {
      lines.push(
        `- ${heading(locale, "Incorrect-use rules", "قواعد الاستخدام غير الصحيح")}: **${rules.incorrectUsage.length}**`,
      );
    }
    lines.push("");
  }

  if (snapshot.project.brand.colors.tokens.length) {
    lines.push(
      `### ${heading(locale, "Colors", "الألوان")}`,
      "",
      "| Role | Name | sRGB |",
      "| --- | --- | --- |",
    );
    for (const color of snapshot.project.brand.colors.tokens) {
      lines.push(
        `| ${color.role} | ${localized(color.name, locale) ?? color.role} | ${color.srgbHex.toUpperCase()} |`,
      );
    }
    lines.push("");
  }

  if (snapshot.project.brand.typography.styles.length) {
    const fonts = new Map(
      snapshot.project.brand.typography.fonts.map((font) => [font.id, font] as const),
    );
    lines.push(
      `### ${heading(locale, "Typography", "الطباعة والخطوط")}`,
      "",
      "| Role | Style | Family | Size / Line height |",
      "| --- | --- | --- | --- |",
    );
    for (const style of snapshot.project.brand.typography.styles) {
      lines.push(
        `| ${style.role} | ${style.name} | ${fonts.get(style.fontRefId)?.familyName ?? "—"} | ${style.fontSize} / ${style.lineHeight} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildBrandGuidelinesMarkdown(
  snapshot: ProjectSnapshot,
  localeMode: TemplateLocaleMode,
): Uint8Array {
  const locales = localeList(localeMode);
  const primaryBrandName =
    localized(snapshot.project.brand.identity.brandName, locales[0] ?? "en") ??
    snapshot.project.metadata.name;
  const lines = [
    "---",
    "format: hawya-brand-guidelines",
    "version: 1",
    `brand: ${yamlString(primaryBrandName)}`,
    `locales: ${JSON.stringify(locales)}`,
    `projectSchemaVersion: ${snapshot.project.schemaVersion}`,
    "---",
    "",
    `<!-- Generated from canonical Hawya project ${snapshot.project.id}. -->`,
    "<!-- Missing brand fields are intentionally omitted; no filler content is generated. -->",
    "",
    ...locales.map((locale) => markdownForLocale(snapshot, locale)),
    "## Asset map",
    "",
    "| ID | Kind | MIME | Source name |",
    "| --- | --- | --- | --- |",
    ...projectAssetMap(snapshot).map(
      (asset) =>
        `| \`${asset.id}\` | ${asset.kind} | ${asset.mime} | ${asset.sourceName.replaceAll("|", "\\|")} |`,
    ),
    "",
    "## Implementation notes",
    "",
    "- CSS and browser raster values are screen-oriented sRGB.",
    "- Print-specific color values remain separate project metadata and are not exported as CSS variables.",
    "- Editable SVG text requires matching fonts on the receiving system.",
    "- Outlined SVG preserves glyph geometry but text is no longer editable or searchable as text.",
    "- Hawya does not claim native .ai/.indd or PDF/X output.",
    "",
  ];
  return utf8(lines.join("\n"));
}

function semanticSectionHtml(snapshot: ProjectSnapshot, locale: Locale): string {
  const identity = snapshot.project.brand.identity;
  const brandName = localized(identity.brandName, locale) ?? snapshot.project.metadata.name;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const rows: string[] = [
    `<section class="brand-section brand-identity" lang="${locale}" dir="${dir}">`,
    `<p class="eyebrow">${escapeHtml(heading(locale, "Identity", "الهوية"))}</p>`,
    `<h2>${escapeHtml(brandName)}</h2>`,
  ];
  const descriptor = localized(identity.descriptor, locale);
  if (descriptor) rows.push(`<p class="lead">${escapeHtml(descriptor)}</p>`);
  const mission = localized(identity.mission, locale);
  if (mission) {
    rows.push(
      `<article><h3>${escapeHtml(heading(locale, "Mission", "الرسالة"))}</h3><p>${escapeHtml(mission)}</p></article>`,
    );
  }
  const vision = localized(identity.vision, locale);
  if (vision) {
    rows.push(
      `<article><h3>${escapeHtml(heading(locale, "Vision", "الرؤية"))}</h3><p>${escapeHtml(vision)}</p></article>`,
    );
  }
  rows.push("</section>");
  return rows.join("");
}

export function buildStaticIndexHtml(
  snapshot: ProjectSnapshot,
  localeMode: TemplateLocaleMode,
  pageFiles: readonly { filename: string; title: string }[],
  assetFiles: readonly StaticGuideAssetFile[] = [],
): Uint8Array {
  const locales = localeList(localeMode);
  const brandName =
    localized(snapshot.project.brand.identity.brandName, locales[0] ?? "en") ??
    snapshot.project.metadata.name;
  const language = locales[0] ?? "en";
  const direction = language === "ar" ? "rtl" : "ltr";

  const identitySections = locales
    .map((locale) => semanticSectionHtml(snapshot, locale))
    .join("\n");

  const colors = snapshot.project.brand.colors.tokens
    .map(
      (token) =>
        `<article class="color-token"><span class="swatch" style="--swatch:${escapeXml(token.srgbHex)}"></span><strong>${escapeHtml(localized(token.name, language) ?? token.role)}</strong><code>${escapeHtml(token.srgbHex.toUpperCase())}</code><small>${escapeHtml(token.role)}</small></article>`,
    )
    .join("\n");

  const fontsById = new Map(
    snapshot.project.brand.typography.fonts.map((font) => [font.id, font] as const),
  );
  const typography = snapshot.project.brand.typography.styles
    .map((style) => {
      const font = fontsById.get(style.fontRefId);
      return `<article class="type-token"><small>${escapeHtml(style.role)}</small><h3>${escapeHtml(style.name)}</h3><p style="font-family:${escapeHtml(cssQuoted(font?.familyName ?? "sans-serif"))};font-size:${Math.min(style.fontSize, 52)}px;line-height:1.2">${escapeHtml(brandName)}</p><code>${escapeHtml(font?.familyName ?? "sans-serif")} · ${style.fontSize}/${style.lineHeight}</code></article>`;
    })
    .join("\n");

  const logoVariants = snapshot.project.brand.logos.variants
    .map((variant) => {
      const file = assetFiles.find((candidate) => candidate.assetId === variant.assetId);
      if (!file) return "";
      return `<article class="logo-card"><img src="${escapeXml(file.filename)}" alt="${escapeHtml(file.alt)}"><strong>${escapeHtml(localized(variant.name, language) ?? variant.role)}</strong><small>${escapeHtml(variant.role)}</small></article>`;
    })
    .join("\n");

  const pages = pageFiles
    .map(
      (page) =>
        `<article class="guide-page"><h3>${escapeHtml(page.title)}</h3><img src="${escapeXml(page.filename)}" alt="${escapeHtml(page.title)}"></article>`,
    )
    .join("\n");

  return utf8(`<!doctype html>
<html lang="${language}" dir="${direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="Hawya Studio">
<title>${escapeHtml(brandName)} · Brand Guide</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="site-header"><p>Brand Guide</p><h1>${escapeHtml(brandName)}</h1><nav><a href="#identity">Identity</a><a href="#logos">Logos</a><a href="#colors">Colors</a><a href="#typography">Typography</a><a href="#pages">Guide pages</a></nav></header>
<main>
<div id="identity">${identitySections}</div>
${logoVariants ? `<section id="logos" class="brand-section"><p class="eyebrow">Logo system</p><h2>Logos</h2><div class="logo-grid">${logoVariants}</div></section>` : ""}
${colors ? `<section id="colors" class="brand-section"><p class="eyebrow">Color system</p><h2>Colors</h2><div class="token-grid">${colors}</div></section>` : ""}
${typography ? `<section id="typography" class="brand-section"><p class="eyebrow">Typography system</p><h2>Typography</h2><div class="type-grid">${typography}</div></section>` : ""}
${pages ? `<section id="pages" class="brand-section"><p class="eyebrow">Presentation appendix</p><h2>Guide pages</h2><div class="page-grid">${pages}</div></section>` : ""}
</main>
<footer><p>Static export owned by the project author · no Hawya backend, editing, or analytics.</p></footer>
</body>
</html>
`);
}

export function buildStaticGuideCss(): Uint8Array {
  return utf8(`:root{font-family:Inter,system-ui,sans-serif;color:#171717;background:#f4f4f2;line-height:1.5}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0}a{color:inherit}.site-header,main,footer{inline-size:min(1180px,calc(100% - 2rem));margin-inline:auto}.site-header{padding-block:3.5rem 2rem}.site-header p,.eyebrow{margin:0 0 .5rem;color:#666;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.site-header h1{font-size:clamp(2.4rem,7vw,5.6rem);line-height:.95;margin:.2rem 0 1.4rem}.site-header nav{display:flex;flex-wrap:wrap;gap:.5rem}.site-header nav a{border:1px solid #d8d8d2;border-radius:999px;padding:.45rem .75rem;text-decoration:none}.brand-section{padding-block:2.5rem;border-top:1px solid #d8d8d2}.brand-section h2{font-size:clamp(1.8rem,4vw,3rem);margin:.2rem 0 1rem}.lead{font-size:clamp(1.2rem,2.2vw,1.8rem);max-width:46rem}.token-grid,.type-grid,.logo-grid,.page-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}.color-token,.type-token,.logo-card,.guide-page{display:grid;gap:.5rem;border:1px solid #d8d8d2;border-radius:16px;background:#fff;padding:1rem}.swatch{display:block;aspect-ratio:16/9;border-radius:10px;background:var(--swatch);border:1px solid #0001}.color-token code,.type-token code{color:#666}.color-token small,.type-token small,.logo-card small{color:#666}.logo-card img{inline-size:100%;block-size:180px;object-fit:contain}.guide-page{grid-column:span 2}.guide-page img{display:block;inline-size:100%;block-size:auto;background:#fff}.type-token p{margin:.5rem 0;overflow-wrap:anywhere}footer{padding-block:2rem 4rem;color:#666}@media(max-width:700px){.guide-page{grid-column:span 1}.site-header{padding-block-start:2rem}}@media print{body{background:#fff}.site-header nav{display:none}.brand-section{break-inside:avoid}.guide-page{break-after:page}}
`);
}

export function buildStaticDeploymentReadme(snapshot: ProjectSnapshot): Uint8Array {
  return utf8(
    [
      `# ${snapshot.project.metadata.name} — Static Brand Guide`,
      "",
      "This folder is a self-contained static site. It does not require a Hawya API, account, database, analytics service, or editing runtime.",
      "",
      "## Deploy",
      "",
      "- GitHub Pages: publish the extracted folder as the site root.",
      "- Vercel / Netlify / other static hosts: deploy the extracted folder with no build command.",
      "- Local review: serve the folder through any simple static HTTP server.",
      "",
      "Keep relative paths intact. If font binaries are present, redistribution rights were explicitly confirmed by the exporting user.",
      "",
    ].join("\n"),
  );
}
