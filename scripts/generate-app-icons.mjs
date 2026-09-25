import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const OUTPUTS = [192, 512];
const BACKGROUND = [16, 16, 16];
const TILE = [244, 241, 234];
const MARK = [16, 16, 16];
const SUPERSAMPLE = 4;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x >= left + radius && x < right - radius) return y >= top && y < bottom;
  if (y >= top + radius && y < bottom - radius) return x >= left && x < right;
  const cx = x < left + radius ? left + radius : right - radius;
  const cy = y < top + radius ? top + radius : bottom - radius;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function insideMark(x, y, size) {
  const left = size * (59 / 192);
  const right = size * (133 / 192);
  const top = size * (57 / 192);
  const bottom = size * (135 / 192);
  const stem = size * (14 / 192);
  const barTop = size * (91 / 192);
  const barBottom = size * (104 / 192);
  return (
    (x >= left && x < left + stem && y >= top && y < bottom) ||
    (x >= right - stem && x < right && y >= top && y < bottom) ||
    (x >= left && x < right && y >= barTop && y < barBottom)
  );
}

function pixelAt(px, py, size) {
  const tileLeft = size * (30 / 192);
  const tileTop = size * (30 / 192);
  const tileRight = size * (163 / 192);
  const tileBottom = size * (163 / 192);
  const radius = size * (22 / 192);
  let tileCoverage = 0;
  let markCoverage = 0;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
    for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
      const x = px + (sx + 0.5) / SUPERSAMPLE;
      const y = py + (sy + 0.5) / SUPERSAMPLE;
      if (insideRoundedRect(x, y, tileLeft, tileTop, tileRight, tileBottom, radius)) {
        tileCoverage += 1;
        if (insideMark(x, y, size)) markCoverage += 1;
      }
    }
  }

  const tileAlpha = tileCoverage / samples;
  const markAlpha = markCoverage / samples;
  const base = BACKGROUND.map((value, index) =>
    Math.round(value * (1 - tileAlpha) + TILE[index] * tileAlpha),
  );
  return base.map((value, index) =>
    Math.round(value * (1 - markAlpha) + MARK[index] * markAlpha),
  );
}

function createPng(size) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixelAt(x, y, size);
      const offset = row + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of OUTPUTS) {
  const output = resolve(`public/icons/hawya-${size}.png`);
  await writeFile(output, createPng(size));
  console.log(`Generated ${output}`);
}
