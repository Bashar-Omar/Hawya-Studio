import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const OUTPUTS = [192, 512];
const BACKGROUND = [16, 16, 16];
const TILE = [244, 241, 234];

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

function createPng(size) {
  const stride = size + 1;
  const raw = Buffer.alloc(stride * size);
  const tileLeft = size * (30 / 192);
  const tileTop = size * (30 / 192);
  const tileRight = size * (163 / 192);
  const tileBottom = size * (163 / 192);
  const radius = size * (22 / 192);

  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const sampleX = x + 0.5;
      const sampleY = y + 0.5;
      const tile = insideRoundedRect(
        sampleX,
        sampleY,
        tileLeft,
        tileTop,
        tileRight,
        tileBottom,
        radius,
      );
      raw[row + 1 + x] = tile && !insideMark(sampleX, sampleY, size) ? 1 : 0;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const palette = Buffer.from([...BACKGROUND, ...TILE]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("PLTE", palette),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of OUTPUTS) {
  const output = resolve(`public/icons/hawya-${size}.png`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, createPng(size));
  console.log(`Generated ${output}`);
}
