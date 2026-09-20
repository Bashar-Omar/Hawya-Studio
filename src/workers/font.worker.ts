/// <reference lib="webworker" />
import fontkit from "@cantoo/fontkit";

import type { FontAnalysisResult } from "@/application/ports/font-analyzer";
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from "@/infrastructure/workers/worker-protocol";

const ARABIC_SAMPLE = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي٠١٢٣٤٥٦٧٨٩،؛؟";

function inferStyle(subfamilyName: string | undefined): "normal" | "italic" | "oblique" {
  const normalized = subfamilyName?.toLowerCase() ?? "";
  if (normalized.includes("oblique")) return "oblique";
  if (normalized.includes("italic")) return "italic";
  return "normal";
}

function inferWeight(
  subfamilyName: string | undefined,
  variationAxes: Record<string, { default: number }> | undefined,
): number | undefined {
  const variableWeight = variationAxes?.wght?.default;
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

function analyze(bytes: Uint8Array): FontAnalysisResult {
  const font = fontkit.create(bytes);
  const raw = font as unknown as Record<string, unknown>;
  const variationAxes = font.variationAxes
    ? Object.entries(font.variationAxes).map(([tag, axis]) => ({
        tag,
        min: axis.min,
        default: axis.default,
        max: axis.max,
      }))
    : undefined;
  const sampleCodePoints = [
    ...new Set(Array.from(ARABIC_SAMPLE, (character) => character.codePointAt(0) ?? 0)),
  ];
  const missingCodePoints = sampleCodePoints.filter(
    (codePoint) => !font.hasGlyphForCodePoint(codePoint),
  );
  const supported = sampleCodePoints.length - missingCodePoints.length;
  return {
    familyName: font.familyName || font.fullName || "Uploaded font",
    ...(font.subfamilyName ? { subfamilyName: font.subfamilyName } : {}),
    ...(font.postscriptName ? { postscriptName: font.postscriptName } : {}),
    weight: inferWeight(font.subfamilyName ?? undefined, font.variationAxes ?? undefined),
    style: inferStyle(font.subfamilyName ?? undefined),
    ...(variationAxes && variationAxes.length > 0 ? { variableAxes } : {}),
    coverage: {
      arabic: {
        supported,
        total: sampleCodePoints.length,
        ratio: sampleCodePoints.length === 0 ? 0 : supported / sampleCodePoints.length,
        missingCodePoints,
        hasGsub: Boolean(raw.GSUB),
        hasGpos: Boolean(raw.GPOS),
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
