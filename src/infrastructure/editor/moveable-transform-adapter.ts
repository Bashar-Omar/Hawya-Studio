import type { LayerTransform } from "@/editor/model/editor-types";
import { documentUnitScale, normalizeTransform } from "@/editor/geometry/geometry";

export interface TransformScaleContext {
  zoom: number;
  unit: "px" | "mm" | "in" | "pt";
}

function screenToDocument(value: number, context: TransformScaleContext): number {
  return value / Math.max(0.01, context.zoom * documentUnitScale(context.unit));
}

export function moveableDragToDocument(
  initial: LayerTransform,
  screenDist: readonly [number, number] | number[],
  context: TransformScaleContext,
): LayerTransform {
  return normalizeTransform({
    ...initial,
    x: initial.x + screenToDocument(screenDist[0] ?? 0, context),
    y: initial.y + screenToDocument(screenDist[1] ?? 0, context),
  });
}

export function moveableResizeToDocument(
  initial: LayerTransform,
  input: { widthPx: number; heightPx: number; dragDist?: readonly [number, number] | number[] },
  context: TransformScaleContext,
): LayerTransform {
  const unitScale = documentUnitScale(context.unit);
  const drag = input.dragDist ?? [0, 0];
  return normalizeTransform({
    ...initial,
    x: initial.x + screenToDocument(drag[0] ?? 0, context),
    y: initial.y + screenToDocument(drag[1] ?? 0, context),
    width: Math.max(1, input.widthPx / unitScale),
    height: Math.max(1, input.heightPx / unitScale),
  });
}

export function moveableRotateToDocument(
  initial: LayerTransform,
  rotation: number,
): LayerTransform {
  return normalizeTransform({ ...initial, rotation });
}
