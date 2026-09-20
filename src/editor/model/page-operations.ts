import type { AssetId } from "@/domain/assets/asset";
import type { GuidePage, Layer } from "@/domain/guide/guide-document";
import { upsertEditorOverride, templateSlotIdFromSceneId } from "@/editor/model/local-overrides";
import type { LayerTransform, SceneLayerId } from "@/editor/model/editor-types";
import { normalizeTransform } from "@/editor/geometry/geometry";

function extraIndex(page: GuidePage, sceneId: SceneLayerId): number {
  return page.extras.findIndex((layer) => layer.id === sceneId);
}

export function applySceneTransform(
  page: GuidePage,
  sceneId: SceneLayerId,
  transform: LayerTransform,
): void {
  const normalized = normalizeTransform(transform);
  const index = extraIndex(page, sceneId);
  if (index >= 0) {
    const layer = page.extras[index];
    if (layer) layer.transform = normalized;
    return;
  }
  if (templateSlotIdFromSceneId(sceneId))
    upsertEditorOverride(page, sceneId, { transform: normalized });
}

export function setSceneVisibility(page: GuidePage, sceneId: SceneLayerId, visible: boolean): void {
  const index = extraIndex(page, sceneId);
  if (index >= 0) {
    const layer = page.extras[index];
    if (layer) layer.visible = visible;
    return;
  }
  if (templateSlotIdFromSceneId(sceneId)) upsertEditorOverride(page, sceneId, { visible });
}

export function setSceneLocked(page: GuidePage, sceneId: SceneLayerId, locked: boolean): void {
  const index = extraIndex(page, sceneId);
  if (index >= 0) {
    const layer = page.extras[index];
    if (layer) layer.locked = locked;
    return;
  }
  if (templateSlotIdFromSceneId(sceneId)) upsertEditorOverride(page, sceneId, { locked });
}

export function setSceneText(page: GuidePage, sceneId: SceneLayerId, text: string): void {
  const index = extraIndex(page, sceneId);
  if (index >= 0) {
    const layer = page.extras[index];
    if (layer?.type === "text") layer.content = text;
    return;
  }
  if (templateSlotIdFromSceneId(sceneId)) upsertEditorOverride(page, sceneId, { text });
}

export function addExtraLayer(page: GuidePage, layer: Layer): void {
  page.extras.push(layer);
}

export function deleteSceneLayers(page: GuidePage, sceneIds: readonly SceneLayerId[]): void {
  const target = new Set(sceneIds);
  const deletedGroups = new Set(
    page.extras
      .filter((layer) => target.has(layer.id) && layer.type === "group")
      .map((layer) => layer.id),
  );
  page.extras = page.extras.filter(
    (layer) => !target.has(layer.id) && !deletedGroups.has(layer.parentGroupId ?? ""),
  );
  for (const sceneId of sceneIds) {
    if (templateSlotIdFromSceneId(sceneId)) upsertEditorOverride(page, sceneId, { visible: false });
  }
}

export function duplicateExtraLayers(
  page: GuidePage,
  sceneIds: readonly SceneLayerId[],
  newIds: readonly string[],
): string[] {
  const originals = sceneIds
    .map((id) => page.extras.find((layer) => layer.id === id))
    .filter((layer): layer is Layer => Boolean(layer) && layer?.type !== "group");
  const created: string[] = [];
  for (const [index, layer] of originals.entries()) {
    const id = newIds[index];
    if (!id) continue;
    const clone = structuredClone(layer);
    clone.id = id;
    clone.name = `${layer.name} copy`;
    delete clone.parentGroupId;
    clone.transform = { ...clone.transform, x: clone.transform.x + 12, y: clone.transform.y + 12 };
    page.extras.push(clone);
    created.push(id);
  }
  return created;
}

export function groupExtraLayers(
  page: GuidePage,
  sceneIds: readonly SceneLayerId[],
  groupId: string,
  groupName = "Group",
): boolean {
  const children = sceneIds
    .map((id) => page.extras.find((layer) => layer.id === id))
    .filter(
      (layer): layer is Layer => Boolean(layer) && !layer?.parentGroupId && layer?.type !== "group",
    );
  if (children.length < 2) return false;
  const minX = Math.min(...children.map((layer) => layer.transform.x));
  const minY = Math.min(...children.map((layer) => layer.transform.y));
  const maxX = Math.max(...children.map((layer) => layer.transform.x + layer.transform.width));
  const maxY = Math.max(...children.map((layer) => layer.transform.y + layer.transform.height));
  for (const child of children) {
    child.parentGroupId = groupId;
    child.transform = {
      ...child.transform,
      x: child.transform.x - minX,
      y: child.transform.y - minY,
    };
  }
  page.extras.push({
    id: groupId,
    name: groupName,
    type: "group",
    visible: true,
    locked: false,
    opacity: 1,
    transform: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    source: "extra",
    data: { childIds: children.map((layer) => layer.id) },
  });
  return true;
}

export function ungroupExtraLayer(page: GuidePage, groupId: SceneLayerId): string[] {
  const group = page.extras.find((layer) => layer.id === groupId && layer.type === "group");
  if (group?.type !== "group") return [];
  const childIds = Array.isArray(group.data.childIds)
    ? group.data.childIds.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
  for (const layer of page.extras) {
    if (layer.parentGroupId !== groupId) continue;
    delete layer.parentGroupId;
    layer.transform = normalizeTransform({
      ...layer.transform,
      x: group.transform.x + layer.transform.x * group.transform.scaleX,
      y: group.transform.y + layer.transform.y * group.transform.scaleY,
      width: layer.transform.width * Math.abs(group.transform.scaleX),
      height: layer.transform.height * Math.abs(group.transform.scaleY),
      rotation: layer.transform.rotation + group.transform.rotation,
    });
  }
  page.extras = page.extras.filter((layer) => layer.id !== groupId);
  return childIds;
}

export function createTextLayer(
  id: string,
  x: number,
  y: number,
  text = "Text",
  options: { language?: string; direction?: "auto" | "ltr" | "rtl" } = {},
): Layer {
  return {
    id,
    name: "Text",
    type: "text",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x, y, width: 260, height: 72, rotation: 0, scaleX: 1, scaleY: 1 },
    source: "extra",
    content: text,
    typography: { fontSize: 36, lineHeight: 1.2, fontWeight: 600 },
    fill: { type: "solid", color: "#111111", alpha: 1 },
    alignment: "start",
    verticalAlign: "top",
    direction: options.direction ?? "auto",
    ...(options.language ? { language: options.language } : {}),
    overflow: "visible",
  };
}

export function createShapeLayer(id: string, x: number, y: number): Layer {
  return {
    id,
    name: "Rectangle",
    type: "shape",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x, y, width: 180, height: 120, rotation: 0, scaleX: 1, scaleY: 1 },
    source: "extra",
    data: { shape: "rect", fill: "#D9DDE7", radius: 8 },
  };
}

export function createAssetLayer(
  id: string,
  assetId: AssetId,
  kind: "image" | "vector",
  x: number,
  y: number,
): Layer {
  if (kind === "image") {
    return {
      id,
      name: "Image",
      type: "image",
      visible: true,
      locked: false,
      opacity: 1,
      transform: { x, y, width: 240, height: 180, rotation: 0, scaleX: 1, scaleY: 1 },
      source: "extra",
      assetId,
      fit: "contain",
    };
  }
  return {
    id,
    name: "Vector",
    type: "vector",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x, y, width: 240, height: 180, rotation: 0, scaleX: 1, scaleY: 1 },
    source: "extra",
    data: { assetId },
  };
}
