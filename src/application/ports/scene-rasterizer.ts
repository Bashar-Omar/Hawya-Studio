import type { RasterFormat } from "@/domain/export/export-contract";

export interface RasterizeSceneInput {
  svg: string;
  width: number;
  height: number;
  scale: number;
  format: RasterFormat;
  quality?: number;
}

export interface SceneRasterizer {
  rasterize(input: RasterizeSceneInput, signal: AbortSignal): Promise<Uint8Array>;
}
