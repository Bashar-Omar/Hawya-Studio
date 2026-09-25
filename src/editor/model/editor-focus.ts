import type { RenderedSceneLayer, SceneLayerId } from "@/editor/model/editor-types";

export function layerFocusTargetAfterDeletion(
  layers: readonly RenderedSceneLayer[],
  deletedIds: ReadonlySet<SceneLayerId>,
  primaryId: SceneLayerId | undefined,
): SceneLayerId | undefined {
  const ordered = [...layers].sort((left, right) => right.zIndex - left.zIndex);
  const anchorIndex = primaryId ? ordered.findIndex((layer) => layer.id === primaryId) : -1;
  const effectiveAnchor = anchorIndex >= 0 ? anchorIndex : 0;

  for (let index = effectiveAnchor + 1; index < ordered.length; index += 1) {
    const candidate = ordered[index];
    if (candidate && !deletedIds.has(candidate.id)) return candidate.id;
  }
  for (let index = effectiveAnchor - 1; index >= 0; index -= 1) {
    const candidate = ordered[index];
    if (candidate && !deletedIds.has(candidate.id)) return candidate.id;
  }
  return ordered.find((layer) => !deletedIds.has(layer.id))?.id;
}
