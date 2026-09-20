import type { FontAnalysisResult, FontAnalyzer } from "@/application/ports/font-analyzer";
import type { AnalysisWorkerResponse } from "@/infrastructure/workers/worker-protocol";

const FONT_ANALYSIS_TIMEOUT_MS = 5000;

export class WorkerFontAnalyzer implements FontAnalyzer {
  private queue: Promise<void> = Promise.resolve();

  analyze(bytes: Uint8Array): Promise<FontAnalysisResult> {
    const task = this.queue.then(
      () => this.run(bytes),
      () => this.run(bytes),
    );
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private run(bytes: Uint8Array): Promise<FontAnalysisResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("../../workers/font.worker.ts", import.meta.url), {
        type: "module",
      });
      const id = crypto.randomUUID();
      const buffer = Uint8Array.from(bytes).buffer;
      const timer = window.setTimeout(() => {
        worker.terminate();
        reject(new Error("Font analysis exceeded the safety time limit"));
      }, FONT_ANALYSIS_TIMEOUT_MS);
      worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
        if (event.data.id !== id) return;
        window.clearTimeout(timer);
        worker.terminate();
        if (event.data.type === "font-result") {
          resolve(event.data.result);
          return;
        }
        reject(
          new Error(
            event.data.type === "error" ? event.data.message : "Unexpected font worker response",
          ),
        );
      };
      worker.onerror = (event) => {
        window.clearTimeout(timer);
        worker.terminate();
        reject(new Error(event.message || "Font worker failed"));
      };
      worker.postMessage({ id, type: "analyze-font", bytes: buffer }, [buffer]);
    });
  }
}
