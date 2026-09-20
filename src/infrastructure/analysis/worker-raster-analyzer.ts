import type { RasterAnalysisResult, RasterAnalyzer } from "@/application/ports/raster-analyzer";
import type { AnalysisWorkerResponse } from "@/infrastructure/workers/worker-protocol";

const RASTER_ANALYSIS_TIMEOUT_MS = 5000;
const MAX_PREVIEW_EDGE = 640;

export class WorkerRasterAnalyzer implements RasterAnalyzer {
  private queue: Promise<void> = Promise.resolve();

  analyze(bytes: Uint8Array, mime: string): Promise<RasterAnalysisResult> {
    const task = this.queue.then(
      () => this.run(bytes, mime),
      () => this.run(bytes, mime),
    );
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private run(bytes: Uint8Array, mime: string): Promise<RasterAnalysisResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("../../workers/asset.worker.ts", import.meta.url), {
        type: "module",
      });
      const id = crypto.randomUUID();
      const buffer = Uint8Array.from(bytes).buffer;
      const timer = window.setTimeout(() => {
        worker.terminate();
        reject(new Error("Raster analysis exceeded the safety time limit"));
      }, RASTER_ANALYSIS_TIMEOUT_MS);
      worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
        if (event.data.id !== id) return;
        window.clearTimeout(timer);
        worker.terminate();
        if (event.data.type === "raster-result") {
          resolve(event.data.result);
          return;
        }
        reject(
          new Error(
            event.data.type === "error" ? event.data.message : "Unexpected raster worker response",
          ),
        );
      };
      worker.onerror = (event) => {
        window.clearTimeout(timer);
        worker.terminate();
        reject(new Error(event.message || "Raster worker failed"));
      };
      worker.postMessage(
        { id, type: "analyze-raster", bytes: buffer, mime, maxPreviewEdge: MAX_PREVIEW_EDGE },
        [buffer],
      );
    });
  }
}
