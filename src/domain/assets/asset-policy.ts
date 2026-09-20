import type { AssetKind } from "@/domain/assets/asset";

export const ASSET_WARN_BYTES = 25 * 1024 * 1024;
export const ASSET_CONFIRM_BYTES = 100 * 1024 * 1024;
export const ASSET_HARD_LIMIT_BYTES = 250 * 1024 * 1024;

export type SupportedAssetFormat =
  | "svg"
  | "png"
  | "jpeg"
  | "webp"
  | "ttf"
  | "otf"
  | "woff"
  | "woff2";

export interface DetectedAssetFile {
  format: SupportedAssetFormat;
  mime: string;
  extension: string;
  defaultKind: Extract<AssetKind, "vector" | "image" | "font">;
}

function startsWith(bytes: Uint8Array, values: readonly number[]): boolean {
  return values.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const prefix = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096));
  const normalized = prefix
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
  return (
    normalized.startsWith("<svg") || (normalized.startsWith("<?xml") && normalized.includes("<svg"))
  );
}

export function detectAssetFile(bytes: Uint8Array): DetectedAssetFile | undefined {
  if (looksLikeSvg(bytes)) {
    return { format: "svg", mime: "image/svg+xml", extension: "svg", defaultKind: "vector" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { format: "png", mime: "image/png", extension: "png", defaultKind: "image" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { format: "jpeg", mime: "image/jpeg", extension: "jpg", defaultKind: "image" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { format: "webp", mime: "image/webp", extension: "webp", defaultKind: "image" };
  }
  if (ascii(bytes, 0, 4) === "wOFF") {
    return { format: "woff", mime: "font/woff", extension: "woff", defaultKind: "font" };
  }
  if (ascii(bytes, 0, 4) === "wOF2") {
    return { format: "woff2", mime: "font/woff2", extension: "woff2", defaultKind: "font" };
  }
  if (ascii(bytes, 0, 4) === "OTTO") {
    return { format: "otf", mime: "font/otf", extension: "otf", defaultKind: "font" };
  }
  if (startsWith(bytes, [0x00, 0x01, 0x00, 0x00]) || ascii(bytes, 0, 4) === "true") {
    return { format: "ttf", mime: "font/ttf", extension: "ttf", defaultKind: "font" };
  }
  return undefined;
}

export function validateAssetSize(byteLength: number): void {
  if (byteLength <= 0) {
    throw new Error("Asset file is empty");
  }
  if (byteLength > ASSET_HARD_LIMIT_BYTES) {
    throw new Error("Asset exceeds Hawya's hard local safety limit");
  }
}

export function validateDeclaredAssetType(
  detected: DetectedAssetFile,
  filename: string,
  declaredMime: string,
): void {
  const extension = filename.toLowerCase().split(".").pop();
  const knownExtensions: Record<string, SupportedAssetFormat> = {
    svg: "svg",
    png: "png",
    jpg: "jpeg",
    jpeg: "jpeg",
    webp: "webp",
    ttf: "ttf",
    otf: "otf",
    woff: "woff",
    woff2: "woff2",
  };
  const expected = extension ? knownExtensions[extension] : undefined;
  if (expected && expected !== detected.format) {
    throw new Error("Asset contents do not match the filename extension");
  }
  const normalizedMime = declaredMime.toLowerCase().trim();
  if (normalizedMime && normalizedMime !== "application/octet-stream") {
    const family = normalizedMime.startsWith("font/")
      ? "font"
      : normalizedMime.startsWith("image/")
        ? "image"
        : "other";
    const detectedFamily = detected.defaultKind === "font" ? "font" : "image";
    if (family !== "other" && family !== detectedFamily) {
      throw new Error("Asset contents do not match the declared MIME type");
    }
  }
}
