import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

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

function inspectPng(bytes, expectedSize) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Invalid PNG signature");
  let offset = 8;
  let width;
  let height;
  let paletteEntries = 0;
  const idat = [];
  let sawEnd = false;

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (crcOffset + 4 > bytes.length) throw new Error("Truncated PNG chunk");
    const type = bytes.subarray(typeStart, dataStart).toString("ascii");
    const data = bytes.subarray(dataStart, dataEnd);
    const expectedCrc = bytes.readUInt32BE(crcOffset);
    const actualCrc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
    if (actualCrc !== expectedCrc) throw new Error(`PNG ${type} CRC mismatch`);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 3) {
        throw new Error("App icon must be an 8-bit indexed PNG");
      }
    } else if (type === "PLTE") {
      if (data.length % 3 !== 0) throw new Error("PNG palette length is invalid");
      paletteEntries = data.length / 3;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      sawEnd = true;
      break;
    }
    offset = crcOffset + 4;
  }

  if (!sawEnd) throw new Error("PNG is missing IEND");
  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(`Expected ${expectedSize}x${expectedSize}, got ${width}x${height}`);
  }
  if (paletteEntries !== 2) throw new Error(`Expected a two-color palette, got ${paletteEntries}`);

  const raw = inflateSync(Buffer.concat(idat));
  const expectedRawLength = expectedSize * (expectedSize + 1);
  if (raw.length !== expectedRawLength) {
    throw new Error(`PNG decoded byte length ${raw.length} does not match ${expectedRawLength}`);
  }
  for (let y = 0; y < expectedSize; y += 1) {
    const row = y * (expectedSize + 1);
    if (raw[row] !== 0) throw new Error("App icon uses unexpected PNG filter");
    for (let x = 0; x < expectedSize; x += 1) {
      if (raw[row + 1 + x] > 1) throw new Error("App icon references an unexpected palette entry");
    }
  }
}

for (const size of [192, 512]) {
  const path = resolve(`public/icons/hawya-${size}.png`);
  inspectPng(await readFile(path), size);
  console.log(`Validated ${path}`);
}
