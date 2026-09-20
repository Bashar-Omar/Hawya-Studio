import type { AssetSource } from "@/application/services/asset-ingestor";

export class BrowserAssetFiles {
  async read(file: File, intendedKind?: AssetSource["intendedKind"]): Promise<AssetSource> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return {
      bytes,
      filename: file.name,
      declaredMime: file.type || "application/octet-stream",
      ...(intendedKind ? { intendedKind } : {}),
    };
  }
}
