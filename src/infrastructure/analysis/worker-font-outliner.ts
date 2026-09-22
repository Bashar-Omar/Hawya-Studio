import type {
  FontOutlineOptions,
  FontOutlineResult,
  FontOutliner,
} from "@/application/ports/font-outliner";
import type {
  ExportWorkerRequest,
  ExportWorkerResponse,
} from "@/infrastructure/workers/export-worker-protocol";

const FONT_OUTLINE_TIMEOUT_MS = 10_000;
const MAX_OUTLINE_CACHE_ENTRIES = 512;

interface PendingOutline {
  resolve: (result: FontOutlineResult) => void;
  reject: (error: Error | DOMException) => void;
  timer: number;
  signal: AbortSignal;
  onAbort: () => void;
  fontKey: string;
  cacheKey: string;
}

function featureKey(options: FontOutlineOptions): string {
  if (!options.features) return "";
  return Object.entries(options.features)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tag, enabled]) => `${tag}:${enabled ? 1 : 0}`)
    .join(",");
}

export class WorkerFontOutliner implements FontOutliner {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingOutline>();
  private fontKeys = new WeakMap<Uint8Array, string>();
  private loadedFontKeys = new Set<string>();
  private cache = new Map<string, FontOutlineResult>();
  private disposed = false;

  outline(
    bytes: Uint8Array,
    text: string,
    options: FontOutlineOptions,
    signal: AbortSignal,
  ): Promise<FontOutlineResult> {
    if (signal.aborted) {
      return Promise.reject(new DOMException("Export cancelled", "AbortError"));
    }
    if (this.disposed) {
      return Promise.reject(new Error("Font outliner is disposed"));
    }

    const fontKey = this.fontKey(bytes);
    const cacheKey = [
      fontKey,
      options.fontSize,
      options.letterSpacing,
      featureKey(options),
      text,
    ].join("\u0000");
    const cached = this.cache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const onAbort = () => {
        this.failAll(new DOMException("Export cancelled", "AbortError"));
      };
      const timer = window.setTimeout(() => {
        this.failAll(new Error("Font outlining exceeded the safety time limit"));
      }, FONT_OUTLINE_TIMEOUT_MS);

      this.pending.set(id, {
        resolve,
        reject,
        timer,
        signal,
        onAbort,
        fontKey,
        cacheKey,
      });
      signal.addEventListener("abort", onAbort, { once: true });

      const includeBytes = !this.loadedFontKeys.has(fontKey);
      const buffer = includeBytes ? Uint8Array.from(bytes).buffer : undefined;
      const request: ExportWorkerRequest = {
        id,
        type: "outline-font",
        fontKey,
        text,
        options,
        ...(buffer ? { bytes: buffer } : {}),
      };
      this.ensureWorker().postMessage(request, buffer ? [buffer] : []);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.failAll(new DOMException("Export runtime disposed", "AbortError"));
    this.cache.clear();
    this.loadedFontKeys.clear();
    this.fontKeys = new WeakMap<Uint8Array, string>();
  }

  private fontKey(bytes: Uint8Array): string {
    const existing = this.fontKeys.get(bytes);
    if (existing) return existing;
    const key = crypto.randomUUID();
    this.fontKeys.set(bytes, key);
    return key;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (this.disposed) throw new Error("Font outliner is disposed");

    const worker = new Worker(new URL("../../workers/font.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
      const pending = this.pending.get(event.data.id);
      if (!pending) return;

      this.cleanupPending(event.data.id, pending);
      if (event.data.type === "font-outline-result") {
        this.loadedFontKeys.add(pending.fontKey);
        this.remember(pending.cacheKey, event.data.result);
        pending.resolve(event.data.result);
        return;
      }
      pending.reject(
        new Error(
          event.data.type === "error" ? event.data.message : "Unexpected font worker response",
        ),
      );
    };
    worker.onerror = (event) => {
      this.failAll(new Error(event.message || "Font worker failed"));
    };
    this.worker = worker;
    return worker;
  }

  private remember(key: string, result: FontOutlineResult): void {
    if (this.cache.size >= MAX_OUTLINE_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (typeof oldest === "string") this.cache.delete(oldest);
    }
    this.cache.set(key, result);
  }

  private cleanupPending(id: string, pending: PendingOutline): void {
    window.clearTimeout(pending.timer);
    pending.signal.removeEventListener("abort", pending.onAbort);
    this.pending.delete(id);
  }

  private failAll(error: Error | DOMException): void {
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    this.loadedFontKeys.clear();

    for (const [id, pending] of this.pending) {
      this.cleanupPending(id, pending);
      pending.reject(error);
    }
  }
}
