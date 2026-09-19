import { unzipSync, zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";

import type { Clock } from "@/application/ports/clock";
import { type ISODateTime, isoDateTimeSchema } from "@/domain/common/primitives";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_SAVE_TIMESTAMP,
} from "../../../tests/fixtures/stage02/synthetic-project";

class FixedClock implements Clock {
  constructor(private readonly value: ISODateTime) {}
  now(): ISODateTime {
    return this.value;
  }
}

function createCodec() {
  return new FflateProjectArchiveCodec(
    new WebCryptoSha256Hasher(),
    new FixedClock(isoDateTimeSchema.parse(SYNTHETIC_SAVE_TIMESTAMP)),
  );
}

describe("FflateProjectArchiveCodec", () => {
  it("rejects non-ZIP input before parsing", async () => {
    const result = await createCodec().decode(strToU8("not a zip"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid-signature");
    }
  });

  it("rejects path traversal before accepting critical entries", async () => {
    const malicious = zipSync({
      "../manifest.json": strToU8("{}"),
      "project.json": strToU8("{}"),
      "checksums.json": strToU8("{}"),
    });
    const result = await createCodec().decode(malicious);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unsafe-path");
    }
  });

  it("detects binary tampering through checksum verification", async () => {
    const hasher = new WebCryptoSha256Hasher();
    const fixture = await createSyntheticProjectFixture(hasher);
    const encoded = await createCodec().encode(fixture);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      throw encoded.error;
    }

    const entries = unzipSync(encoded.value);
    const binaryPath = Object.keys(entries).find((path) => path.startsWith("assets/"));
    expect(binaryPath).toBeDefined();
    if (!binaryPath) {
      return;
    }
    const tampered = Uint8Array.from(entries[binaryPath] ?? []);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    entries[binaryPath] = tampered;

    const result = await createCodec().decode(zipSync(entries));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("checksum-mismatch");
    }
  });
});
