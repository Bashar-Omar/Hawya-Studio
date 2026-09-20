import type { LayerTransform, RenderedSceneLayer } from "@/editor/model/editor-types";

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeNumber(value: number, precision = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function normalizeTransform(transform: LayerTransform): LayerTransform {
  return {
    x: normalizeNumber(transform.x),
    y: normalizeNumber(transform.y),
    width: Math.max(0, normalizeNumber(transform.width)),
    height: Math.max(0, normalizeNumber(transform.height)),
    rotation: normalizeNumber(((transform.rotation % 360) + 360) % 360),
    scaleX: normalizeNumber(transform.scaleX),
    scaleY: normalizeNumber(transform.scaleY),
  };
}

export function transformBounds(transform: LayerTransform): RectBounds {
  return {
    x: transform.x,
    y: transform.y,
    width: transform.width * Math.abs(transform.scaleX || 1),
    height: transform.height * Math.abs(transform.scaleY || 1),
  };
}

export function rectsIntersect(a: RectBounds, b: RectBounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function selectionBounds(layers: RenderedSceneLayer[]): RectBounds | undefined {
  if (layers.length === 0) return undefined;
  const bounds = layers.map((layer) => transformBounds(layer.transform));
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export type AlignmentCommand = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";

export function alignTransforms(
  layers: RenderedSceneLayer[],
  command: AlignmentCommand,
): Record<string, LayerTransform> {
  const bounds = selectionBounds(layers);
  if (!bounds) return {};
  return Object.fromEntries(
    layers.map((layer) => {
      const current = layer.transform;
      const visual = transformBounds(current);
      let x = current.x;
      let y = current.y;
      if (command === "left") x = bounds.x;
      if (command === "center-x") x = bounds.x + (bounds.width - visual.width) / 2;
      if (command === "right") x = bounds.x + bounds.width - visual.width;
      if (command === "top") y = bounds.y;
      if (command === "center-y") y = bounds.y + (bounds.height - visual.height) / 2;
      if (command === "bottom") y = bounds.y + bounds.height - visual.height;
      return [layer.id, normalizeTransform({ ...current, x, y })];
    }),
  );
}

export type DistributionCommand = "horizontal" | "vertical";

export function distributeTransforms(
  layers: RenderedSceneLayer[],
  command: DistributionCommand,
): Record<string, LayerTransform> {
  if (layers.length < 3) return {};
  const sorted = [...layers].sort((a, b) =>
    command === "horizontal" ? a.transform.x - b.transform.x : a.transform.y - b.transform.y,
  );
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return {};
  const totalSize = sorted.reduce(
    (sum, layer) =>
      sum +
      (command === "horizontal"
        ? transformBounds(layer.transform).width
        : transformBounds(layer.transform).height),
    0,
  );
  const firstBounds = transformBounds(first.transform);
  const lastBounds = transformBounds(last.transform);
  const span =
    command === "horizontal"
      ? lastBounds.x + lastBounds.width - firstBounds.x
      : lastBounds.y + lastBounds.height - firstBounds.y;
  const gap = (span - totalSize) / (sorted.length - 1);
  let cursor = command === "horizontal" ? firstBounds.x : firstBounds.y;
  const result: Record<string, LayerTransform> = {};
  for (const layer of sorted) {
    const visual = transformBounds(layer.transform);
    result[layer.id] = normalizeTransform({
      ...layer.transform,
      ...(command === "horizontal" ? { x: cursor } : { y: cursor }),
    });
    cursor += (command === "horizontal" ? visual.width : visual.height) + gap;
  }
  return result;
}

export function documentUnitScale(unit: "px" | "mm" | "in" | "pt"): number {
  if (unit === "mm") return 96 / 25.4;
  if (unit === "in") return 96;
  if (unit === "pt") return 96 / 72;
  return 1;
}
