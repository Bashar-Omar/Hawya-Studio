import type { AssetSanitizer, SanitizedSvgResult } from "@/application/ports/asset-sanitizer";

const FORBIDDEN_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
] as const;

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function inspectRiskyFeatures(source: string): string[] {
  const features: string[] = [];
  const lower = source.toLowerCase();
  for (const tag of FORBIDDEN_TAGS) {
    if (lower.includes(`<${tag.toLowerCase()}`)) {
      features.push(`tag:${tag}`);
    }
  }
  if (/\son[a-z]+\s*=/i.test(source)) {
    features.push("event-handler");
  }
  if (/javascript\s*:/i.test(source)) {
    features.push("javascript-url");
  }
  if (/\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/)/i.test(source)) {
    features.push("external-reference");
  }
  if (/url\s*\(\s*["']?\s*(?:https?:|\/\/|javascript:)/i.test(source)) {
    features.push("external-css-url");
  }
  if (/@import/i.test(source)) {
    features.push("external-stylesheet");
  }
  return unique(features);
}

function parseSvgMetadata(svg: string): Record<string, unknown> {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = documentNode.documentElement;
  const colors = new Set<string>();
  for (const node of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of ["fill", "stroke", "stop-color"]) {
      const value = node.getAttribute(attribute)?.trim();
      if (value && value !== "none" && !value.startsWith("url(")) {
        colors.add(value);
      }
    }
  }
  return {
    viewBox: root.getAttribute("viewBox") ?? undefined,
    width: root.getAttribute("width") ?? undefined,
    height: root.getAttribute("height") ?? undefined,
    detectedColors: [...colors].slice(0, 32),
    externalReferenceStatus: "none",
  };
}

function enforceLocalReferences(svg: string, rejectedFeatures: string[]): string {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = documentNode.documentElement;
  for (const node of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) {
        node.removeAttribute(attribute.name);
        rejectedFeatures.push("event-handler");
        continue;
      }
      if ((name === "href" || name === "xlink:href") && value && !value.startsWith("#")) {
        node.removeAttribute(attribute.name);
        rejectedFeatures.push("external-reference");
      }
      if (name === "style") {
        node.removeAttribute(attribute.name);
        rejectedFeatures.push("inline-style");
      }
    }
  }
  return new XMLSerializer().serializeToString(root);
}

export class DomPurifySvgSanitizer implements AssetSanitizer {
  async sanitizeSvg(source: string): Promise<SanitizedSvgResult> {
    const rejectedFeatures = inspectRiskyFeatures(source);
    const { default: DOMPurify } = await import("dompurify");
    const sanitized = DOMPurify.sanitize(source, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: [...FORBIDDEN_TAGS],
      FORBID_ATTR: ["style"],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
    });
    const localOnly = enforceLocalReferences(String(sanitized), rejectedFeatures);
    const parsed = new DOMParser().parseFromString(localOnly, "image/svg+xml");
    if (
      parsed.querySelector("parsererror") ||
      parsed.documentElement.tagName.toLowerCase() !== "svg"
    ) {
      throw new Error("SVG could not be parsed after sanitization");
    }
    if (
      parsed.querySelector(
        "script, foreignObject, iframe, object, embed, animate, animateMotion, animateTransform, set",
      )
    ) {
      throw new Error("SVG contains unsupported executable content");
    }
    return {
      svg: localOnly,
      rejectedFeatures: unique(rejectedFeatures),
      metadata: parseSvgMetadata(localOnly),
    };
  }
}
