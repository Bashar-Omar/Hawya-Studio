export interface RasterPreview {
  bytes: Uint8Array;
  mime: "image/webp";
  width: number;
  height: number;
}

export interface RasterAnalysisResult {
  width: number;
  height: number;
  hasAlpha: boolean;
  visibleBounds?: { x: number; y: number; width: number; height: number };
  cropSuggestion?: { x: number; y: number; width: number; height: number };
  paletteCandidates?: string[];
  preview?: RasterPreview;
}

export interface RasterAnalyzer {
  analyze(bytes: Uint8Array, mime: string): Promise<RasterAnalysisResult>;
}
