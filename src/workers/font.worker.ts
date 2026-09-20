/// <reference lib="webworker" />
import fontkit from "@cantoo/fontkit";

import type { FontAnalysisResult } from "@/application/ports/font-analyzer";
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from "@/infrastructure/workers/worker-protocol";

const ARABIC_SAMPLE = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي٠١٢٣٤٥٦٧٨٩،؛؟";

type VariableAxis = { tag: string; min: number; default: number; max: number };

interface AnalyzableFont {
  familyName: string | null;
  fullName: string | null;
  subfamilyName: string | null;
  postscriptName: string | null;
  characterSet: readonly number[];
  hasGlyphForCodePoint(codePoint: number): boolean;
}

function inferStyle(subfamilyName: string | undefined): "normal" | "italic" | "oblique" {
  const normalized = subfamilyName?.toLowerCase() ?? "";
  if (normalized.includes("oblique")) return "oblique";
  if (normalized.includes("italic")) return "italic";
  return "normal";
}

function inferWeight(
  subfamilyName: string | undefined,
  variationAxes: readonly VariableAxis[],
): number {
  const variableWeight = variationAxes.find((axis) => axis.tag === "wght")?.default;
  if (typeof variableWeight === "number") return Math.round(variableWeight);
  const value = subfamilyName?.toLowerCase() ?? "";
  if (value.includes("thin")) return 100;
  if (value.includes("extra light") || value.includes("ultralight")) return 200;
  if (value.includes("light")) return 300;
  if (value.includes("medium")) return 500;
  if (value.includes("semi bold") || value.includes("semibold")) return 600;
  if (value.includes("extra bold") || value.includes("extrabold")) return 800;
  if (value.includes("black") || value.includes("heavy")) return 900;
  if (value.includes("bold")) return 700;
  return 400;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function requireAnalyzableFont(value: unknown): AnalyzableFont {
  if (!value || typeof value !== "object") {
    throw new Error("Font parser returned no font");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.hasGlyphForCodePoint !== "function" || !Array.isArray(record.characterSet)) {
    throw new Error("Font collections are not supported by this ingestion path");
  }
  return {
    familyName: optionalString(record.familyName),
    fullName: optionalString(record.fullName),
    subfamilyName: optionalString(record.subfamilyName),
    postscriptName: optionalString(record.postscriptName),
    characterSet: record.characterSet.filter(
      (codePoint): codePoint is number => typeof codePoint === "number" && Number.isFinite(codePoint),
    ),
    hasGlyphForCodePoint: (codePoint) =>
      (record.hasGlyphForCodePoint as (value: number) => boolean).call(value, codePoint),
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseVariableAxes(value: unknown): VariableAxis[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const axes: VariableAxis[] = [];
  for (const [tag, candidate] of Object.entries(value)) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const min = finiteNumber(record.min);
    const defaultValue = finiteNumber(record.default);
    const max = finiteNumber(record.max);
    if (min === undefined || defaultValue === undefined || max === undefined) continue;
    axes.push({ tag, min, default: defaultValue, max });
  }
  return axes;
}

function analyze(bytes: Uint8Array): FontAnalysisResult {
  const parsed = fontkit.create(bytes);
  const raw = parsed as unknown as Record<string, unknown> | null;
  const font = requireAnalyzableFont(parsed);
  const variableAxes = parseVariableAxes(raw?.variationAxes);
  const sampleCodePoints = [
    ...new Set(Array.from(ARABIC_SAMPLE, (character) => character.codePointAt(0) ?? 0)),
  ];
  const missingCodePoints = sampleCodePoints.filter(
    (codePoint) => !font.hasGlyphForCodePoint(codePoint),
  );
  const supported = sampleCodePoints.length - missingCodePoints.length;
  const familyName = font.familyName || font.fullName || "Uploaded font";
  const subfamilyName = font.subfamilyName ?? undefined;
  const postscriptName = font.postscriptName ?? undefined;
  return {
    familyName,
    ...(subfamilyName ? { subfamilyName } : {}),
    ...(postscriptName ? { postscriptName } : {}),
    weight: inferWeight(subfamilyName, variableAxes),
    style: inferStyle(subfamilyName),
    ...(variableAxes.length > 0 ? { variableAxes } : {}),
    coverage: {
      arabic: {
        supported,
        total: sampleCodePoints.length,
        ratio: sampleCodePoints.length === 0 ? 0 : supported / sampleCodePoints.length,
        missingCodePoints,
        hasGsub: Boolean(raw?.GSUB),
        hasGpos: Boolean(raw?.GPOS),
      },
      characterCount: font.characterSet.length,
    },
  };
}

self.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
  const request = event.data;
  if (request.type !== "analyze-font") return;
  let response: AnalysisWorkerResponse;
  try {
    response = {
      id: request.id,
      type: "font-result",
      result: analyze(new Uint8Array(request.bytes)),
    };
  } catch (error) {
    response = {
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : "Font analysis failed",
    };
  }
  self.postMessage(response);
};
