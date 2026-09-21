import type { AssetId } from "@/domain/assets/asset";
import type { ContentDirection, Paint } from "@/domain/common/primitives";
import type { Layer } from "@/domain/guide/guide-document";

export type LayerTransform = Layer["transform"];
export type SceneLayerId = string;

export type EditorTool = "select" | "hand" | "text" | "shape" | "asset";

export interface EditorViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface EditorSelectionState {
  selectedIds: SceneLayerId[];
  primaryId?: SceneLayerId;
}

export interface EditorSnapGuide {
  axis: "x" | "y";
  value: number;
  source: "page" | "margin" | "layer" | "template";
}

interface RenderedSceneLayerBase {
  id: SceneLayerId;
  name: string;
  source: "template" | "extra";
  visible: boolean;
  locked: boolean;
  opacity: number;
  transform: LayerTransform;
  zIndex: number;
  parentGroupId?: SceneLayerId;
}

export interface RenderedTextLayer extends RenderedSceneLayerBase {
  type: "text";
  text: string;
  direction: "auto" | ContentDirection;
  language?: string;
  alignment: "start" | "center" | "end" | "justify";
  fill: string;
}

export interface RenderedImageLayer extends RenderedSceneLayerBase {
  type: "image";
  assetId: AssetId;
  fit: "cover" | "contain" | "fill";
  cornerRadius?: number;
}

export interface RenderedVectorLayer extends RenderedSceneLayerBase {
  type: "vector";
  assetId?: AssetId;
}

export interface RenderedShapeLayer extends RenderedSceneLayerBase {
  type: "shape";
  shape: "rect" | "ellipse" | "line";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  palette?: string[];
}

export interface RenderedGroupLayer extends RenderedSceneLayerBase {
  type: "group";
  childIds: SceneLayerId[];
}

export type RenderedSceneLayer =
  | RenderedTextLayer
  | RenderedImageLayer
  | RenderedVectorLayer
  | RenderedShapeLayer
  | RenderedGroupLayer;

export interface RenderedScene {
  pageWidth: number;
  pageHeight: number;
  background: Paint;
  layers: RenderedSceneLayer[];
}

