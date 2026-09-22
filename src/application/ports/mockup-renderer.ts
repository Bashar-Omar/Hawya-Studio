import type { NormalizedRect } from "@/domain/common/primitives";
import type { MockupSurface } from "@/domain/mockup/mockup";

export interface MockupBinarySource {
  key: string;
  mime: string;
  bytes: Uint8Array;
}

export interface MockupRenderInput {
  background: MockupBinarySource;
  crop: NormalizedRect;
  surface?: MockupSurface;
  artwork?: MockupBinarySource;
  maxDimension?: number;
}

export interface MockupRenderProgress {
  value: number;
  stage: "decode" | "background" | "warp" | "composite" | "encode";
}

export interface MockupRenderResult {
  bytes: Uint8Array;
  width: number;
  height: number;
  mime: "image/png";
  engine: "webgl" | "canvas";
}

export interface MockupRenderer {
  render(
    input: MockupRenderInput,
    signal: AbortSignal,
    onProgress?: (progress: MockupRenderProgress) => void,
  ): Promise<MockupRenderResult>;
  dispose(): void;
}
