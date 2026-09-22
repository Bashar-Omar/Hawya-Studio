import type {
  MockupRenderInput,
  MockupRenderer,
  MockupRenderProgress,
  MockupRenderResult,
} from "@/application/ports/mockup-renderer";
import {
  MOCKUP_WORKER_PROTOCOL_VERSION,
  type MockupWorkerRequest,
  type MockupWorkerResponse,
} from "@/infrastructure/workers/mockup-worker-protocol";

const MOCKUP_RENDER_TIMEOUT_MS = 45_000;

interface PendingRender {
  resolve: (result: MockupRenderResult) => void;
  reject: (error: Error | DOMException) => void;
  onProgress?: (progress: MockupRenderProgress) => void;
  timer: number;
  signal: AbortSignal;
  onAbort: () => void;
}

export function supportsMockupWorker(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  );
}

export class WorkerMockupRenderer implements MockupRenderer {
  private worker: Worker | null = null;
  private queue: Promise<void> = Promise.resolve();
  private pending = new Map<string, PendingRender>();
  private disposed = false;

  render(
    input: MockupRenderInput,
    signal: AbortSignal,
    onProgress?: (progress: MockupRenderProgress) => void,
  ): Promise<MockupRenderResult> {
    const task = this.queue.then(
      () => this.run(input, signal, onProgress),
      () => this.run(input, signal, onProgress),
    );
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [id, pending] of this.pending) {
      this.cleanup(id, pending);
      pending.reject(new DOMException("Mockup renderer disposed", "AbortError"));
    }
    this.worker?.terminate();
    this.worker = null;
  }

  private run(
    input: MockupRenderInput,
    signal: AbortSignal,
    onProgress?: (progress: MockupRenderProgress) => void,
  ): Promise<MockupRenderResult> {
    if (signal.aborted) return Promise.reject(new DOMException("Render cancelled", "AbortError"));
    if (this.disposed) return Promise.reject(new Error("Mockup renderer is disposed"));
    if (!supportsMockupWorker()) {
      return Promise.reject(new Error("Smart mockup rendering is unavailable in this browser"));
    }

    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const onAbort = () => {
        this.ensureWorker().postMessage({
          version: MOCKUP_WORKER_PROTOCOL_VERSION,
          id,
          type: "cancel",
        } satisfies MockupWorkerRequest);
        const pending = this.pending.get(id);
        if (pending) this.cleanup(id, pending);
        reject(new DOMException("Render cancelled", "AbortError"));
      };
      const timer = window.setTimeout(() => {
        const pending = this.pending.get(id);
        if (pending) this.cleanup(id, pending);
        reject(new Error("Mockup render exceeded the safety time limit"));
      }, MOCKUP_RENDER_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, onProgress, timer, signal, onAbort });
      signal.addEventListener("abort", onAbort, { once: true });

      const background = Uint8Array.from(input.background.bytes).buffer;
      const artwork = input.artwork ? Uint8Array.from(input.artwork.bytes).buffer : undefined;
      const request: MockupWorkerRequest = {
        version: MOCKUP_WORKER_PROTOCOL_VERSION,
        id,
        type: "render",
        background: {
          key: input.background.key,
          mime: input.background.mime,
          bytes: background,
        },
        crop: input.crop,
        ...(input.surface ? { surface: input.surface } : {}),
        ...(input.artwork && artwork
          ? {
              artwork: {
                key: input.artwork.key,
                mime: input.artwork.mime,
                bytes: artwork,
              },
            }
          : {}),
        ...(input.maxDimension ? { maxDimension: input.maxDimension } : {}),
      };
      const transfers = artwork ? [background, artwork] : [background];
      this.ensureWorker().postMessage(request, transfers);
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (this.disposed) throw new Error("Mockup renderer is disposed");
    const worker = new Worker(new URL("../../workers/mockup.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<MockupWorkerResponse>) => {
      const response = event.data;
      if (response.version !== MOCKUP_WORKER_PROTOCOL_VERSION) return;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      if (response.type === "progress") {
        pending.onProgress?.({ value: response.value, stage: response.stage });
        return;
      }
      this.cleanup(response.id, pending);
      if (response.type === "result") {
        pending.resolve({
          bytes: new Uint8Array(response.bytes),
          width: response.width,
          height: response.height,
          mime: response.mime,
          engine: response.engine,
        });
      } else {
        pending.reject(new Error(response.message));
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "Mockup worker failed");
      for (const [id, pending] of this.pending) {
        this.cleanup(id, pending);
        pending.reject(error);
      }
      worker.terminate();
      if (this.worker === worker) this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  private cleanup(id: string, pending: PendingRender): void {
    window.clearTimeout(pending.timer);
    pending.signal.removeEventListener("abort", pending.onAbort);
    this.pending.delete(id);
  }
}
