import type { Asset, AssetId, ContentHash } from "@/domain/assets/asset";
import type { RenderedSceneLayer } from "@/editor/model/editor-types";

const EDITOR_VISUAL_ASSET_KINDS = new Set<Asset["kind"]>([
  "image",
  "mockup",
  "vector",
  "logo",
  "icon",
  "illustration",
]);

export interface EditorAssetHydrationEntry {
  assetId: AssetId;
  binaryKey: ContentHash;
}

export function editorAssetHydrationPlan(
  assets: readonly Asset[],
  layers: readonly RenderedSceneLayer[],
): EditorAssetHydrationEntry[] {
  const assetById = new Map(assets.map((asset) => [asset.id, asset] as const));
  const requestedIds = new Set<AssetId>();

  for (const layer of layers) {
    if (layer.type === "image") {
      requestedIds.add(layer.assetId);
    } else if (layer.type === "vector" && layer.assetId) {
      requestedIds.add(layer.assetId);
    }
  }

  return [...requestedIds].flatMap((assetId) => {
    const asset = assetById.get(assetId);
    if (!asset || !EDITOR_VISUAL_ASSET_KINDS.has(asset.kind)) return [];
    return [
      {
        assetId,
        binaryKey: asset.previewBinaryKey ?? asset.binaryKey,
      },
    ];
  });
}
