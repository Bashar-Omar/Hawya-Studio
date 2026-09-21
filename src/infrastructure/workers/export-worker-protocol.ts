import type { FontOutlineOptions, FontOutlineResult } from "@/application/ports/font-outliner";
import type { RasterFormat } from "@/domain/export/export-contract";

export type ExportWorkerRequest =
  | {
      id: string;
      type: "outline-font";
      bytes: ArrayBuffer;
      text: string;
      options: FontOutlineOptions;
    }
  | {
      id: string;
      type: "rasterize-svg";
      svg: string;
      width: number;
      height: number;
      scale: number;
      format: RasterFormat;
      quality?: number;
    }
  | {
      id: string;
      type: "package-archive";
      entries: Array<{ path: string; bytes: ArrayBuffer }>;
    };

export type ExportWorkerResponse =
  | { id: string; type: "font-outline-result"; result: FontOutlineResult }
  | { id: string; type: "raster-result"; bytes: ArrayBuffer; mime: string }
  | { id: string; type: "archive-result"; bytes: ArrayBuffer }
  | { id: string; type: "error"; message: string };
