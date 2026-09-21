/// <reference lib="webworker" />
import type {
  ExportWorkerRequest,
  ExportWorkerResponse,
} from "@/infrastructure/workers/export-worker-protocol";

const MIME_BY_FORMAT = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" } as const;

self.onmessage = async (event: MessageEvent<ExportWorkerRequest>) => {
  const request = event.data;
  if (request.type !== "rasterize-svg") return;
  let response: ExportWorkerResponse;
  try {
    const width = Math.max(1, Math.round(request.width));
    const height = Math.max(1, Math.round(request.height));
    if (width * height > 100_000_000)
      throw new Error("Raster export exceeds the 100 megapixel safety limit");
    const source = new Blob([request.svg], { type: "image/svg+xml" });
    const bitmap = await createImageBitmap(source);
    try {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D raster context is unavailable");
      context.clearRect(0, 0, width, height);
      if (request.background) {
        context.fillStyle = request.background;
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(bitmap, 0, 0, width, height);
      const mime = MIME_BY_FORMAT[request.format];
      const blob = await canvas.convertToBlob({
        type: mime,
        ...(request.quality !== undefined ? { quality: request.quality } : {}),
      });
      if (blob.type && blob.type !== mime) {
        throw new Error(`${request.format.toUpperCase()} export is not supported by this browser`);
      }
      const bytes = await blob.arrayBuffer();
      response = { id: request.id, type: "raster-result", bytes, mime };
    } finally {
      bitmap.close();
    }
  } catch (error) {
    response = {
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : "Raster export failed",
    };
  }
  if (response.type === "raster-result") self.postMessage(response, [response.bytes]);
  else self.postMessage(response);
};
