import type { RasterizeSceneInput, SceneRasterizer } from "@/application/ports/scene-rasterizer";
import type { ExportWorkerResponse } from "@/infrastructure/workers/export-worker-protocol";

const RASTER_TIMEOUT_MS = 30_000;

export class WorkerSceneRasterizer implements SceneRasterizer {
  private queue: Promise<void> = Promise.resolve();

  rasterize(input: RasterizeSceneInput, signal: AbortSignal): Promise<Uint8Array> {
    const task = this.queue.then(() => this.run(input, signal), () => this.run(input, signal));
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  private run(input: RasterizeSceneInput, signal: AbortSignal): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException("Export cancelled", "AbortError")); return; }
      const worker = new Worker(new URL("../../workers/export-raster.worker.ts", import.meta.url), { type: "module" });
      const id = crypto.randomUUID();
      const timer = window.setTimeout(() => {
        worker.terminate();
        reject(new Error("Raster export exceeded the safety time limit"));
      }, RASTER_TIMEOUT_MS);
      const cleanup = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        worker.terminate();
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException("Export cancelled", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
        if (event.data.id !== id) return;
        cleanup();
        if (event.data.type === "raster-result") resolve(new Uint8Array(event.data.bytes));
        else reject(new Error(event.data.type === "error" ? event.data.message : "Unexpected raster worker response"));
      };
      worker.onerror = (event) => { cleanup(); reject(new Error(event.message || "Raster worker failed")); };
      worker.postMessage({ id, type: "rasterize-svg", ...input });
    });
  }
}
