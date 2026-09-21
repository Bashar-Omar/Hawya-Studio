import { strToU8, zipSync } from "fflate";
import type { ExportArtifact } from "@/domain/export/export-contract";

export function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function escapeHtml(value: string): string { return escapeXml(value); }

export function slugifyFilename(value: string): string {
  const safe = value.normalize("NFKD").replace(/[^p{Letter}p{Number}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return safe || "hawya-export";
}

export function utf8(value: string): Uint8Array { return strToU8(value); }

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  return btoa(binary);
}

export function dataUri(mime: string, bytes: Uint8Array): string { return `data:${mime};base64,${bytesToBase64(bytes)}`; }

export function zipArtifacts(artifacts: readonly ExportArtifact[]): Uint8Array {
  const files = Object.fromEntries(artifacts.map((artifact) => [artifact.filename, artifact.bytes]));
  return zipSync(files, { level: 6, mtime: new Date("1980-01-01T00:00:00.000Z") });
}
