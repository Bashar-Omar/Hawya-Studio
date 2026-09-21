import type { LogoAnalyzer } from "@/application/ports/logo-analyzer";
import type { RasterAnalyzer } from "@/application/ports/raster-analyzer";
import {
  buildLogoGeometryInsight,
  type LogoGeometryInsight,
  type SmartBounds,
} from "@/domain/smart/logo-analysis";

function finitePositive(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseViewBox(svg: SVGSVGElement): { x: number; y: number; width: number; height: number } {
  const attribute = svg.getAttribute("viewBox")?.trim();
  if (attribute) {
    const numbers = attribute.split(/[\s,]+/).map(Number);
    if (
      numbers.length === 4 &&
      numbers.every(Number.isFinite) &&
      (numbers[2] ?? 0) > 0 &&
      (numbers[3] ?? 0) > 0
    ) {
      return {
        x: numbers[0] ?? 0,
        y: numbers[1] ?? 0,
        width: numbers[2] ?? 100,
        height: numbers[3] ?? 100,
      };
    }
  }
  return {
    x: 0,
    y: 0,
    width: finitePositive(svg.getAttribute("width")) ?? 100,
    height: finitePositive(svg.getAttribute("height")) ?? 100,
  };
}

function clampBoundsToCanvas(
  bounds: SmartBounds,
  canvas: { x: number; y: number; width: number; height: number },
): SmartBounds {
  const left = Math.max(canvas.x, bounds.x);
  const top = Math.max(canvas.y, bounds.y);
  const right = Math.min(canvas.x + canvas.width, bounds.x + bounds.width);
  const bottom = Math.min(canvas.y + canvas.height, bounds.y + bounds.height);
  return {
    x: Math.max(0, left - canvas.x),
    y: Math.max(0, top - canvas.y),
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

async function normalizeColor(value: string): Promise<string | undefined> {
  const candidate = value.trim();
  if (
    !candidate ||
    candidate === "none" ||
    candidate === "currentColor" ||
    candidate.startsWith("url(")
  ) {
    return undefined;
  }
  try {
    const Color = (await import("colorjs.io")).default;
    const color = new Color(candidate).to("srgb");
    const coords = color.coords.map((channel) =>
      Math.round(
        Math.min(1, Math.max(0, Number.isFinite(channel ?? 0) ? (channel ?? 0) : 0)) * 255,
      ),
    );
    return `#${coords
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
  } catch {
    return undefined;
  }
}

async function svgPalette(svg: SVGSVGElement): Promise<string[]> {
  const raw = new Set<string>();
  for (const element of svg.querySelectorAll("[fill],[stroke],stop[stop-color]")) {
    for (const attribute of ["fill", "stroke", "stop-color"] as const) {
      const value = element.getAttribute(attribute);
      if (value) raw.add(value);
    }
  }
  const colors = await Promise.all([...raw].map(normalizeColor));
  return [...new Set(colors.filter((value): value is string => Boolean(value)))].slice(0, 12);
}

export class BrowserLogoAnalyzer implements LogoAnalyzer {
  constructor(private readonly rasters: RasterAnalyzer) {}

  async analyze(bytes: Uint8Array, mime: string): Promise<LogoGeometryInsight> {
    if (mime !== "image/svg+xml") {
      const raster = await this.rasters.analyze(bytes, mime);
      const visibleBounds = raster.visibleBounds ?? {
        x: 0,
        y: 0,
        width: raster.width,
        height: raster.height,
      };
      return buildLogoGeometryInsight(
        "raster",
        { width: raster.width, height: raster.height },
        visibleBounds,
        raster.paletteCandidates ?? [],
      );
    }

    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const root = parsed.documentElement;
    if (
      root.localName !== "svg" ||
      root.namespaceURI !== "http://www.w3.org/2000/svg" ||
      parsed.querySelector("parsererror")
    ) {
      throw new Error("Logo SVG could not be parsed for geometry analysis");
    }
    const svgRoot = root as unknown as SVGSVGElement;
    const viewBox = parseViewBox(svgRoot);
    const mounted = document.importNode(svgRoot, true) as SVGSVGElement;
    mounted.setAttribute("width", String(viewBox.width));
    mounted.setAttribute("height", String(viewBox.height));
    mounted.style.position = "fixed";
    mounted.style.insetInlineStart = "-100000px";
    mounted.style.insetBlockStart = "0";
    mounted.style.visibility = "hidden";
    mounted.style.pointerEvents = "none";
    document.body.append(mounted);
    let rawBounds: SmartBounds;
    try {
      const measured = mounted.getBBox();
      rawBounds = {
        x: measured.x,
        y: measured.y,
        width: measured.width,
        height: measured.height,
      };
    } catch {
      rawBounds = { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height };
    } finally {
      mounted.remove();
    }
    const visibleBounds = clampBoundsToCanvas(rawBounds, viewBox);
    const safeBounds =
      visibleBounds.width > 0 && visibleBounds.height > 0
        ? visibleBounds
        : { x: 0, y: 0, width: viewBox.width, height: viewBox.height };
    return buildLogoGeometryInsight(
      "svg",
      { width: viewBox.width, height: viewBox.height },
      safeBounds,
      await svgPalette(svgRoot),
    );
  }
}
