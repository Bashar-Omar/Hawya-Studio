import type { FontAnalysisResult } from "@/application/ports/font-analyzer";
import type { RasterAnalysisResult } from "@/application/ports/raster-analyzer";

export type AnalysisWorkerRequest =
  | { id: string; type: "analyze-font"; bytes: ArrayBuffer }
  | {
      id: string;
      type: "analyze-raster";
      bytes: ArrayBuffer;
      mime: string;
      maxPreviewEdge: number;
    };

export type AnalysisWorkerResponse =
  | { id: string; type: "font-result"; result: FontAnalysisResult }
  | { id: string; type: "raster-result"; result: RasterAnalysisResult }
  | { id: string; type: "error"; message: string };
