import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import { canonicalJson } from "@/infrastructure/archive/canonical-json";
import { escapeHtml, escapeXml, utf8 } from "@/infrastructure/export/export-helpers";

type Locale = "en" | "ar";

function localized(
  value: { en?: string; ar?: string } | undefined,
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
      brand: {
        name: snapshot.project.brand.identity.brandName,
        colors,
        typography,
        ...(snapshot.project.brand.digital
          ? { digital: snapshot.project.brand.digital }
          : {}),
      },
    }),
  );
}

export function buildCssVariables(snapshot: ProjectSnapshot): Uint8Array {
  const fontsById = new Map(
    snapshot.project.brand.typography.fonts.map((font) => [font.id, font] as const),
  );
  const lines = [
    "/* Hawya Studio digital tokens · sRGB / screen values only */",
    ":root {",
  ];

  for (const token of [...snapshot.project.brand.colors.tokens].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    lines.push(
      `  --hawya-color-${token.role}-${suffix(token.id)}: ${token.srgbHex.toUpperCase()};`,
    );
    lines.push(
      `  --hawya-color-${token.role}-${suffix(token.id)}-alpha: ${token.alpha};`,
    );
  }

  for (const style of [...snapshot.project.brand.typography.styles].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const font = fontsById.get(style.fontRefId);
    const key = `${style.role}-${suffix(style.id)}`;
    lines.push(
      `  --hawya-type-${key}-family: ${cssQuoted(font?.familyName ?? "sans-serif")};`,
    );
    lines.push(`  --hawya-type-${key}-size: ${style.fontSize}px;`);
    lines.push(`  --hawya-type-${key}-line-height: ${style.lineHeight}px;`);
    lines.push(`  --hawya-type-${key}-letter-spacing: ${style.letterSpacing}px;`);
    lines.push(
      `  --hawya-type-${key}-weight: ${style.fontWeight ?? font?.weight ?? 400};`,
    );
  }

  lines.push("}", "");
  return utf8(lines.join("\n"));
}

function markdownForLocale(snapshot: ProjectSnapshot, locale: Locale): string {
  const identity = snapshot.project.brand.identity;
  const label = locale === "ar" ? "العربية" : "English";
  const brandName = localized(identity.brandName, locale) ?? snapshot.project.metadata.name;
  const lines = [`## ${label}`, "", `# ${brandName}`, ""];

  const descriptor = localized(identity.descriptor, locale);
  if (descriptor) lines.push(descriptor, "");
  const story = localized(identity.story, locale);
  if (story) lines.push("### Story", "", story, "");
  const mission = localized(identity.mission, locale);
  if (mission) lines.push("### Mission", "", mission, "");
  const vision = localized(identity.vision, locale);
  if (vision) lines.push("### Vision", "", vision, "");

  if (identity.values.length) {
    lines.push("### Values", "");
    for (const value of identity.values) {
      const name = localized(value.name, locale);
      if (!name) continue;
      const description = localized(value.description, locale);
      lines.push(`- **${name}**${description ? `: ${description}` : ""}`);
    }
    lines.push("");
  }

  if (snapshot.project.brand.colors.tokens.length) {
    lines.push("### Colors", "", "| Role | Name | sRGB |", "| --- | --- | --- |");
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
      "### Typography",
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

  const rules = snapshot.project.brand.logos.rules;
  if (rules.clearSpace || rules.minimumSize || rules.incorrectUsage.length) {
    lines.push("### Logo rules", "");
    if (rules.clearSpace) lines.push(`- Clear space rule source: **${rules.clearSpace.source}**`);
    if (rules.minimumSize) lines.push(`- Minimum size rule source: **${rules.minimumSize.source}**`);
    if (rules.incorrectUsage.length) {
      lines.push(`- Incorrect-use rules: **${rules.incorrectUsage.length}**`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildBrandGuidelinesMarkdown(
  snapshot: ProjectSnapshot,
  localeMode: TemplateLocaleMode,
): Uint8Array {
  const header = [
    `<!-- Generated from Hawya Studio project schema ${snapshot.project.schemaVersion}. -->`,
    "<!-- Missing brand fields are intentionally omitted; no filler content is generated. -->",
    "",
  ];
  return utf8(
    [...header, ...localeList(localeMode).map((locale) => markdownForLocale(snapshot, locale))]
      .join("\n")
      .trimEnd()
      .concat("\n"),
  );
}

export function buildStaticIndexHtml(
  snapshot: ProjectSnapshot,
  localeMode: TemplateLocaleMode,
  pageFiles: readonly { filename: string; title: string }[],
  fontCss = "",
): Uint8Array {
  const brandName =
    localized(snapshot.project.brand.identity.brandName, localeMode === "ar" ? "ar" : "en") ??
    snapshot.project.metadata.name;
  const direction = localeMode === "ar" ? "rtl" : "ltr";
  const language = localeMode === "ar" ? "ar" : "en";
  const pages = pageFiles
    .map(
      (page) =>
        `<section class="guide-page"><h2>${escapeHtml(page.title)}</h2><img src="${escapeXml(page.filename)}" alt="${escapeHtml(page.title)}"></section>`,
    )
    .join("\n");
  return utf8(`<!doctype html>
<html lang="${language}" dir="${direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(brandName)} · Brand Guide</title>
<link rel="stylesheet" href="styles.css">
<style>${fontCss}</style>
</head>
<body>
<header><p>Brand Guide</p><h1>${escapeHtml(brandName)}</h1></header>
<main>${pages}</main>
</body>
</html>
`);
}

export function buildStaticGuideCss(): Uint8Array {
  return utf8(`:root{font-family:Inter,system-ui,sans-serif;color:#171717;background:#f4f4f2}*{box-sizing:border-box}body{margin:0}header,main{inline-size:min(1200px,calc(100% - 2rem));margin-inline:auto}header{padding-block:3rem 1.5rem}header p{margin:0 0 .5rem;color:#666}h1,h2{margin-block:.25rem 1rem}.guide-page{margin-block:0 3rem}.guide-page img{display:block;inline-size:100%;block-size:auto;background:#fff;box-shadow:0 1px 12px #00000014}@media print{body{background:#fff}.guide-page{break-after:page;box-shadow:none}header{break-after:page}}
`);
}
