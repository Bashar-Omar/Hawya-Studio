import type { NormalizedRect } from "@/domain/common/primitives";
import type { MockupSurface } from "@/domain/mockup/mockup";

export const MOCKUP_WORKER_PROTOCOL_VERSION = 1 as const;

export interface MockupWorkerBinary {
  key: string;
  mime: string;
  bytes: ArrayBuffer;
}

export type MockupWorkerRequest =
  | {
      version: typeof MOCKUP_WORKER_PROTOCOL_VERSION;
      id: string;
      type: "render";
      background: MockupWorkerBinary;
      crop: NormalizedRect;
      surface?: MockupSurface;
      artwork?: MockupWorkerBinary;
      maxDimension?: number;
    }
  | {
      version: typeof MOCKUP_WORKER_PROTOCOL_VERSION;
      id: string;
      type: "cancel";
    };

export type MockupWorkerResponse =
  | {
      version: typeof MOCKUP_WORKER_PROTOCOL_VERSION;
      id: string;
      type: "progress";
      value: number;
      stage: "decode" | "background" | "warp" | "composite" | "encode";
    }
  | {
      version: typeof MOCKUP_WORKER_PROTOCOL_VERSION;
      id: string;
      type: "result";
      bytes: ArrayBuffer;
      width: number;
      height: number;
      mime: "image/png";
      engine: "webgl" | "canvas";
    }
  | {
      version: typeof MOCKUP_WORKER_PROTOCOL_VERSION;
      id: string;
      type: "error";
      message: string;
    };
