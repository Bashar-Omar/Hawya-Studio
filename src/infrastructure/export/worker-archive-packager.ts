import type { ArchiveEntry, ArchivePackager } from "@/application/ports/archive-packager";
import type { ExportWorkerResponse } from "@/infrastructure/workers/export-worker-protocol";

const ARCHIVE_TIMEOUT_MS = 30_000;

export class WorkerArchivePackager implements ArchivePackager {
  private queue: Promise<void> = Promise.resolve();

  pack(entries: readonly ArchiveEntry[], signal: AbortSignal): Promise<Uint8Array> {
    const task = this.queue.then(
      () => this.run(entries, signal),
      () => this.run(entries, signal),
    );
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private run(entries: readonly ArchiveEntry[], signal: AbortSignal): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Export cancelled", "AbortError"));
        return;
      }

      const worker = new Worker(new URL("../../workers/export-archive.worker.ts", import.meta.url), {
        type: "module",
      });
      const id = crypto.randomUUID();
      const payload = entries.map((entry) => ({
        path: entry.path,
        bytes: Uint8Array.from(entry.bytes).buffer,
      }));
      const transfer = payload.map((entry) => entry.bytes);
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
        reject(new Error("ZIP packaging exceeded the safety time limit"));
      }, ARCHIVE_TIMEOUT_MS);

      signal.addEventListener("abort", onAbort, { once: true });
      worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
        if (event.data.id !== id) return;
        cleanup();
        if (event.data.type === "archive-result") {
          resolve(new Uint8Array(event.data.bytes));
        } else {
          reject(
            new Error(
              event.data.type === "error" ? event.data.message : "Unexpected archive worker response",
            ),
          );
        }
      };
      worker.onerror = (event) => {
        cleanup();
        reject(new Error(event.message || "Archive worker failed"));
      };
      worker.postMessage({ id, type: "package-archive", entries: payload }, transfer);
    });
  }
}
