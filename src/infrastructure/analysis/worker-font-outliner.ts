import type {
  FontOutlineOptions,
  FontOutlineResult,
  FontOutliner,
} from "@/application/ports/font-outliner";
import type { ExportWorkerResponse } from "@/infrastructure/workers/export-worker-protocol";

const FONT_OUTLINE_TIMEOUT_MS = 10_000;

export class WorkerFontOutliner implements FontOutliner {
  private queue: Promise<void> = Promise.resolve();

  outline(
    bytes: Uint8Array,
    text: string,
    options: FontOutlineOptions,
    signal: AbortSignal,
  ): Promise<FontOutlineResult> {
    const task = this.queue.then(
      () => this.run(bytes, text, options, signal),
      () => this.run(bytes, text, options, signal),
    );
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private run(
    bytes: Uint8Array,
    text: string,
    options: FontOutlineOptions,
    signal: AbortSignal,
  ): Promise<FontOutlineResult> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Export cancelled", "AbortError"));
        return;
      }

      const worker = new Worker(new URL("../../workers/font.worker.ts", import.meta.url), {
        type: "module",
      });
      const id = crypto.randomUUID();
      const buffer = Uint8Array.from(bytes).buffer;
      const cleanup = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        worker.terminate();
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException("Export cancelled", "AbortError"));
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Font outlining exceeded the safety time limit"));
      }, FONT_OUTLINE_TIMEOUT_MS);

      signal.addEventListener("abort", onAbort, { once: true });
      worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
        if (event.data.id !== id) return;
        cleanup();
        if (event.data.type === "font-outline-result") {
          resolve(event.data.result);
        } else {
          reject(
            new Error(
              event.data.type === "error"
                ? event.data.message
                : "Unexpected font worker response",
            ),
          );
        }
      };
      worker.onerror = (event) => {
        cleanup();
        reject(new Error(event.message || "Font worker failed"));
      };
      worker.postMessage({ id, type: "outline-font", bytes: buffer, text, options }, [buffer]);
    });
  }
}
