/// <reference lib="webworker" />
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from "@/infrastructure/workers/worker-protocol";

async function analyzeRaster(bytes: Uint8Array, mime: string, maxPreviewEdge: number) {
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: mime });
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxPreviewEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Raster preview context is unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const previewBlob = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
  const previewBytes = new Uint8Array(await previewBlob.arrayBuffer());
  return {
    width: canvas.width / scale,
    height: canvas.height / scale,
    hasAlpha: mime === "image/png" || mime === "image/webp",
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
