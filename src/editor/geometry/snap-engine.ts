import type {
  EditorSnapGuide,
  LayerTransform,
  RenderedSceneLayer,
} from "@/editor/model/editor-types";
import { normalizeTransform, transformBounds } from "@/editor/geometry/geometry";

export interface SnapResult {
  transform: LayerTransform;
  guides: EditorSnapGuide[];
}

interface AxisCandidate {
  value: number;
  source: EditorSnapGuide["source"];
}

function axisCandidates(
  axis: "x" | "y",
  pageSize: number,
  layers: RenderedSceneLayer[],
  excludedIds: ReadonlySet<string>,
): AxisCandidate[] {
  const values: AxisCandidate[] = [
    { value: 0, source: "page" },
    { value: pageSize / 2, source: "page" },
    { value: pageSize, source: "page" },
    { value: pageSize * 0.05, source: "margin" },
    { value: pageSize * 0.95, source: "margin" },
  ];
  for (const layer of layers) {
    if (!layer.visible || layer.locked || excludedIds.has(layer.id)) continue;
    const bounds = transformBounds(layer.transform);
    const start = axis === "x" ? bounds.x : bounds.y;
    const size = axis === "x" ? bounds.width : bounds.height;
    values.push(
      { value: start, source: layer.source === "template" ? "template" : "layer" },
      { value: start + size / 2, source: layer.source === "template" ? "template" : "layer" },
      { value: start + size, source: layer.source === "template" ? "template" : "layer" },
    );
  }
  return values;
}

function bestSnap(points: number[], candidates: AxisCandidate[], threshold: number) {
  let best: { delta: number; candidate: AxisCandidate } | undefined;
  for (const point of points) {
    for (const candidate of candidates) {
      const delta = candidate.value - point;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, candidate };
    }
  }
  return best;
}

export function snapTransform(input: {
  transform: LayerTransform;
  pageWidth: number;
  pageHeight: number;
  candidateLayers: RenderedSceneLayer[];
  movingIds: ReadonlySet<string>;
  thresholdDocumentUnits: number;
  disabled?: boolean;
}): SnapResult {
  if (input.disabled) return { transform: normalizeTransform(input.transform), guides: [] };
  const bounds = transformBounds(input.transform);
  const x = bestSnap(
    [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width],
    axisCandidates("x", input.pageWidth, input.candidateLayers, input.movingIds),
    input.thresholdDocumentUnits,
  );
  const y = bestSnap(
    [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height],
    axisCandidates("y", input.pageHeight, input.candidateLayers, input.movingIds),
    input.thresholdDocumentUnits,
  );
  return {
    transform: normalizeTransform({
      ...input.transform,
      x: input.transform.x + (x?.delta ?? 0),
      y: input.transform.y + (y?.delta ?? 0),
    }),
    guides: [
      ...(x ? [{ axis: "x" as const, value: x.candidate.value, source: x.candidate.source }] : []),
      ...(y ? [{ axis: "y" as const, value: y.candidate.value, source: y.candidate.source }] : []),
    ],
  };
}
