/// <reference lib="webworker" />
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from "@/infrastructure/workers/worker-protocol";
import { analyzeRasterPixels } from "@/domain/smart/raster-insights";

async function analyzeRaster(bytes: Uint8Array, mime: string, maxPreviewEdge: number) {
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: mime });
  const bitmap = await createImageBitmap(blob);
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const scale = Math.min(1, maxPreviewEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!context) throw new Error("Raster preview context is unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const imageData = context.getImageData(0, 0, width, height);
  const insights = analyzeRasterPixels(imageData.data, width, height);
  const normalized = insights.visibleBounds;
  const visibleBounds = normalized
    ? {
        x: normalized.x * sourceWidth,
        y: normalized.y * sourceHeight,
        width: normalized.width * sourceWidth,
        height: normalized.height * sourceHeight,
      }
    : undefined;
  const previewBlob = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
  const previewBytes = new Uint8Array(await previewBlob.arrayBuffer());
  return {
    width: sourceWidth,
    height: sourceHeight,
    hasAlpha: mime === "image/png" || mime === "image/webp",
    ...(visibleBounds ? { visibleBounds, cropSuggestion: normalized } : {}),
    paletteCandidates: insights.paletteCandidates,
    preview: { bytes: previewBytes, mime: "image/webp" as const, width, height },
  };
}

self.onmessage = async (event: MessageEvent<AnalysisWorkerRequest>) => {
  const request = event.data;
  if (request.type !== "analyze-raster") return;
  let response: AnalysisWorkerResponse;
  try {
    const result = await analyzeRaster(
      new Uint8Array(request.bytes),
      request.mime,
      request.maxPreviewEdge,
    );
    response = { id: request.id, type: "raster-result", result };
  } catch (error) {
    response = {
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : "Raster analysis failed",
    };
  }
  self.postMessage(response);
};
