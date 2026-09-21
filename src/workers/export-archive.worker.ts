/// <reference lib="webworker" />
import { zipSync } from "fflate";

import type { ExportWorkerRequest, ExportWorkerResponse } from "@/infrastructure/workers/export-worker-protocol";

const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/;

function validatePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+/g, "/");
  if (!SAFE_PATH.test(normalized) || normalized.endsWith("/") || normalized.includes("\u0000")) {
    throw new Error(`Unsafe archive path: ${path}`);
  }
  return normalized;
}

self.onmessage = (event: MessageEvent<ExportWorkerRequest>) => {
  const request = event.data;
  if (request.type !== "package-archive") return;

  let response: ExportWorkerResponse;
  try {
    if (request.entries.length > 2_000) throw new Error("Export package exceeds the entry safety limit");
    const files: Record<string, Uint8Array> = {};
    let totalBytes = 0;
    for (const entry of request.entries) {
      const path = validatePath(entry.path);
      if (files[path]) throw new Error(`Duplicate archive path: ${path}`);
      const bytes = new Uint8Array(entry.bytes);
      totalBytes += bytes.byteLength;
      if (totalBytes > 500 * 1024 * 1024) throw new Error("Export package exceeds the 500 MB safety limit");
      files[path] = bytes;
    }
    const bytes = zipSync(files, {
      level: 6,
      mtime: new Date("1980-01-01T00:00:00.000Z"),
    });
    response = {
      id: request.id,
      type: "archive-result",
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  } catch (error) {
    response = {
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : "Export package failed",
    };
  }

  if (response.type === "archive-result") self.postMessage(response, [response.bytes]);
  else self.postMessage(response);
};
