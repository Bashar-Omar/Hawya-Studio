import type { AssetSource } from "@/application/services/asset-ingestor";
import { validateAssetSize } from "@/domain/assets/asset-policy";

export class BrowserAssetFiles {
  async read(file: File, intendedKind?: AssetSource["intendedKind"]): Promise<AssetSource> {
    validateAssetSize(file.size);
    const bytes = new Uint8Array(await file.arrayBuffer());
    return {
      bytes,
      filename: file.name,
      declaredMime: file.type || "application/octet-stream",
      ...(intendedKind ? { intendedKind } : {}),
    };
  }
}
