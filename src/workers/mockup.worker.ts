/// <reference lib="webworker" />

import { homographyFromUnitSquare, invertMatrix3, type Matrix3 } from "@/domain/mockup/homography";
import type { MockupPoint, MockupSurface } from "@/domain/mockup/mockup";
import {
  MOCKUP_WORKER_PROTOCOL_VERSION,
  type MockupWorkerRequest,
  type MockupWorkerResponse,
} from "@/infrastructure/workers/mockup-worker-protocol";

const MAX_MOCKUP_PIXELS = 40_000_000;
const FALLBACK_GRID = 20;
const MAX_DECODED_BITMAPS = 8;
const cancelled = new Set<string>();
const bitmapCache = new Map<string, ImageBitmap>();

function post(response: MockupWorkerResponse, transfers: Transferable[] = []): void {
  self.postMessage(response, transfers);
}

function progress(
  id: string,
  value: number,
  stage: Extract<MockupWorkerResponse, { type: "progress" }>["stage"],
): void {
  post({ version: MOCKUP_WORKER_PROTOCOL_VERSION, id, type: "progress", value, stage });
}

function checkCancelled(id: string): void {
  if (cancelled.has(id)) throw new DOMException("Render cancelled", "AbortError");
}

function outputSize(
  sourceWidth: number,
  sourceHeight: number,
  crop: { width: number; height: number },
  maxDimension = 4096,
): { width: number; height: number } {
  const croppedWidth = Math.max(1, Math.round(sourceWidth * crop.width));
  const croppedHeight = Math.max(1, Math.round(sourceHeight * crop.height));
  const scale = Math.min(1, maxDimension / Math.max(croppedWidth, croppedHeight));
  const width = Math.max(1, Math.round(croppedWidth * scale));
  const height = Math.max(1, Math.round(croppedHeight * scale));
  if (width * height > MAX_MOCKUP_PIXELS) {
    throw new Error("Mockup output exceeds the 40 megapixel safety limit");
  }
  return { width, height };
}

function touchBitmap(key: string, bitmap: ImageBitmap): ImageBitmap {
  bitmapCache.delete(key);
  bitmapCache.set(key, bitmap);
  while (bitmapCache.size > MAX_DECODED_BITMAPS) {
    const oldestKey = bitmapCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldest = bitmapCache.get(oldestKey);
    bitmapCache.delete(oldestKey);
    oldest?.close();
  }
  return bitmap;
}

async function decode(source: {
  key: string;
  bytes: ArrayBuffer;
  mime: string;
}): Promise<ImageBitmap> {
  const cached = bitmapCache.get(source.key);
  if (cached) return touchBitmap(source.key, cached);
  const decoded = await createImageBitmap(new Blob([source.bytes], { type: source.mime }));
  return touchBitmap(source.key, decoded);
}

function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL shader allocation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "WebGL shader compilation failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function linkProgram(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL program allocation failed");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "WebGL program linking failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function warpWebGl(
  artwork: ImageBitmap,
  width: number,
  height: number,
  surface: MockupSurface,
): OffscreenCanvas | undefined {
  const canvas = new OffscreenCanvas(width, height);
  const gl =
    canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true }) ??
    canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
  if (!gl) return undefined;

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_dest;
    void main() {
      v_dest = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;
    uniform sampler2D u_texture;
    uniform mat3 u_inverse;
    varying vec2 v_dest;
    void main() {
      vec3 projected = u_inverse * vec3(v_dest.x, 1.0 - v_dest.y, 1.0);
      vec2 source = projected.xy / projected.z;
      if (source.x < 0.0 || source.x > 1.0 || source.y < 0.0 || source.y > 1.0) {
        discard;
      }
      gl_FragColor = texture2D(u_texture, vec2(source.x, 1.0 - source.y));
    }
  `;
  const program = linkProgram(gl, vertexSource, fragmentSource);
  try {
    gl.useProgram(program);
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const inverseLocation = gl.getUniformLocation(program, "u_inverse");
    const textureLocation = gl.getUniformLocation(program, "u_texture");
    if (positionLocation < 0 || !inverseLocation || !textureLocation) {
      throw new Error("WebGL mockup uniforms are unavailable");
    }

    const positions = gl.createBuffer();
    const texture = gl.createTexture();
    if (!positions || !texture) throw new Error("WebGL mockup resource allocation failed");

    gl.bindBuffer(gl.ARRAY_BUFFER, positions);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artwork);
    gl.uniform1i(textureLocation, 0);

    const inverse = invertMatrix3(homographyFromUnitSquare(surface.corners));
    gl.uniformMatrix3fv(inverseLocation, false, new Float32Array(inverse));
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.deleteBuffer(positions);
    gl.deleteTexture(texture);
    return canvas;
  } finally {
    gl.deleteProgram(program);
  }
}

function mapQuadPoint(
  matrix: Matrix3,
  u: number,
  v: number,
  width: number,
  height: number,
): MockupPoint {
  const denominator = matrix[6] * u + matrix[7] * v + matrix[8];
  return {
    x: ((matrix[0] * u + matrix[1] * v + matrix[2]) / denominator) * width,
    y: ((matrix[3] * u + matrix[4] * v + matrix[5]) / denominator) * height,
  };
}

function drawTriangle(
  context: OffscreenCanvasRenderingContext2D,
  artwork: ImageBitmap,
  source: readonly [MockupPoint, MockupPoint, MockupPoint],
  destination: readonly [MockupPoint, MockupPoint, MockupPoint],
): void {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const x0 = s0.x * artwork.width;
  const y0 = s0.y * artwork.height;
  const x1 = s1.x * artwork.width;
  const y1 = s1.y * artwork.height;
  const x2 = s2.x * artwork.width;
  const y2 = s2.y * artwork.height;
  const denominator = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(denominator) < 1e-8) return;

  const a = (d0.x * (y1 - y2) + d1.x * (y2 - y0) + d2.x * (y0 - y1)) / denominator;
  const c = (d0.x * (x2 - x1) + d1.x * (x0 - x2) + d2.x * (x1 - x0)) / denominator;
  const e =
    (d0.x * (x1 * y2 - x2 * y1) + d1.x * (x2 * y0 - x0 * y2) + d2.x * (x0 * y1 - x1 * y0)) /
    denominator;
  const b = (d0.y * (y1 - y2) + d1.y * (y2 - y0) + d2.y * (y0 - y1)) / denominator;
  const d = (d0.y * (x2 - x1) + d1.y * (x0 - x2) + d2.y * (x1 - x0)) / denominator;
  const f =
    (d0.y * (x1 * y2 - x2 * y1) + d1.y * (x2 * y0 - x0 * y2) + d2.y * (x0 * y1 - x1 * y0)) /
    denominator;

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.setTransform(a, b, c, d, e, f);
  context.drawImage(artwork, 0, 0);
  context.restore();
}

function warpCanvas(
  artwork: ImageBitmap,
  width: number,
  height: number,
  surface: MockupSurface,
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D mockup context is unavailable");

  const matrix = homographyFromUnitSquare(surface.corners);
  for (let row = 0; row < FALLBACK_GRID; row += 1) {
    const v0 = row / FALLBACK_GRID;
    const v1 = (row + 1) / FALLBACK_GRID;
    for (let column = 0; column < FALLBACK_GRID; column += 1) {
      const u0 = column / FALLBACK_GRID;
      const u1 = (column + 1) / FALLBACK_GRID;
      const s00 = { x: u0, y: v0 };
      const s10 = { x: u1, y: v0 };
      const s11 = { x: u1, y: v1 };
      const s01 = { x: u0, y: v1 };
      const d00 = mapQuadPoint(matrix, u0, v0, width, height);
      const d10 = mapQuadPoint(matrix, u1, v0, width, height);
      const d11 = mapQuadPoint(matrix, u1, v1, width, height);
      const d01 = mapQuadPoint(matrix, u0, v1, width, height);
      drawTriangle(context, artwork, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(context, artwork, [s00, s11, s01], [d00, d11, d01]);
    }
  }
  return canvas;
}

function tintedSilhouette(
  source: OffscreenCanvas,
  color: string,
  width: number,
  height: number,
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D mockup context is unavailable");
  context.drawImage(source, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
  return canvas;
}

function compositeArtwork(
  output: OffscreenCanvasRenderingContext2D,
  warped: OffscreenCanvas,
  width: number,
  height: number,
  surface: MockupSurface,
): void {
  if (surface.shadowStrength > 0) {
    const shadow = tintedSilhouette(warped, "#000000", width, height);
    output.save();
    output.globalAlpha = surface.shadowStrength * 0.28;
    output.drawImage(shadow, Math.max(1, width * 0.008), Math.max(1, height * 0.008));
    output.restore();
  }

  output.save();
  output.globalAlpha = surface.opacity;
  output.globalCompositeOperation =
    surface.blendMode === "multiply"
      ? "multiply"
      : surface.blendMode === "screen"
        ? "screen"
        : "source-over";
  output.drawImage(warped, 0, 0);
  output.restore();

  if (surface.highlightStrength > 0) {
    const highlight = tintedSilhouette(warped, "#ffffff", width, height);
    output.save();
    output.globalAlpha = surface.highlightStrength * 0.18;
    output.globalCompositeOperation = "screen";
    output.drawImage(highlight, -Math.max(1, width * 0.004), -Math.max(1, height * 0.004));
    output.restore();
  }
}

async function render(
  request: Extract<MockupWorkerRequest, { type: "render" }>,
): Promise<Extract<MockupWorkerResponse, { type: "result" }>> {
  checkCancelled(request.id);
  progress(request.id, 0.08, "decode");
  const background = await decode(request.background);
  let artwork: ImageBitmap | undefined;
  try {
    if (request.surface) {
      if (!request.artwork) throw new Error("Smart mockup surface requires artwork");
      artwork = await decode(request.artwork);
    }
    checkCancelled(request.id);

    const size = outputSize(
      background.width,
      background.height,
      request.crop,
      request.maxDimension,
    );
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D mockup context is unavailable");

    progress(request.id, 0.26, "background");
    const sx = Math.round(request.crop.x * background.width);
    const sy = Math.round(request.crop.y * background.height);
    const sw = Math.max(1, Math.round(request.crop.width * background.width));
    const sh = Math.max(1, Math.round(request.crop.height * background.height));
    context.drawImage(background, sx, sy, sw, sh, 0, 0, size.width, size.height);
    checkCancelled(request.id);

    let engine: "webgl" | "canvas" = "canvas";
    if (request.surface && artwork) {
      progress(request.id, 0.48, "warp");
      let warped: OffscreenCanvas | undefined;
      try {
        warped = warpWebGl(artwork, size.width, size.height, request.surface);
        if (warped) engine = "webgl";
      } catch {
        warped = undefined;
      }
      if (!warped) {
        warped = warpCanvas(artwork, size.width, size.height, request.surface);
        engine = "canvas";
      }
      checkCancelled(request.id);
      progress(request.id, 0.76, "composite");
      compositeArtwork(context, warped, size.width, size.height, request.surface);
    }

    progress(request.id, 0.92, "encode");
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const bytes = await blob.arrayBuffer();
    progress(request.id, 1, "encode");
    return {
      version: MOCKUP_WORKER_PROTOCOL_VERSION,
      id: request.id,
      type: "result",
      bytes,
      width: size.width,
      height: size.height,
      mime: "image/png",
      engine,
    };
  } finally {
    // Decoded bitmaps are content-addressed and kept in the worker's bounded LRU cache.
  }
}

self.onmessage = async (event: MessageEvent<MockupWorkerRequest>) => {
  const request = event.data;
  if (request.version !== MOCKUP_WORKER_PROTOCOL_VERSION) return;
  if (request.type === "cancel") {
    cancelled.add(request.id);
    return;
  }

  cancelled.delete(request.id);
  try {
    const response = await render(request);
    if (!cancelled.has(request.id)) post(response, [response.bytes]);
  } catch (error) {
    if (!cancelled.has(request.id)) {
      post({
        version: MOCKUP_WORKER_PROTOCOL_VERSION,
        id: request.id,
        type: "error",
        message: error instanceof Error ? error.message : "Mockup render failed",
      });
    }
  } finally {
    cancelled.delete(request.id);
  }
};
