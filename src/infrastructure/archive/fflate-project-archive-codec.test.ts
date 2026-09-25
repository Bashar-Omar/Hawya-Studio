import { unzipSync, zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";

import type { Clock } from "@/application/ports/clock";
import { type ISODateTime, isoDateTimeSchema } from "@/domain/common/primitives";
import { cloneDefaultMockupQuad } from "@/domain/mockup/mockup";
import { projectSnapshotSchema } from "@/domain/project/hawya-project";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import type { ProjectArchivePolicy } from "@/infrastructure/archive/project-archive-policy";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_LOGO_ASSET_ID,
  SYNTHETIC_PROJECT_ID,
  SYNTHETIC_SAVE_TIMESTAMP,
  SYNTHETIC_TIMESTAMP,
} from "../../../tests/fixtures/stage02/synthetic-project";

class FixedClock implements Clock {
  constructor(private readonly value: ISODateTime) {}
  now(): ISODateTime {
    return this.value;
  }
}

function createCodec(policy?: ProjectArchivePolicy) {
  const hasher = new WebCryptoSha256Hasher();
  const clock = new FixedClock(isoDateTimeSchema.parse(SYNTHETIC_SAVE_TIMESTAMP));
  return policy
    ? new FflateProjectArchiveCodec(hasher, clock, policy)
    : new FflateProjectArchiveCodec(hasher, clock);
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

  it("rejects compressed archives before decompression when the archive byte budget is exceeded", async () => {
    const policy: ProjectArchivePolicy = {
      maxCompressedBytes: 4,
      maxEntries: 10,
      maxEntryUncompressedBytes: 1024,
      maxTotalUncompressedBytes: 4096,
    };
    const result = await createCodec(policy).decode(zipSync({ "project.json": strToU8("{}") }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("archive-too-large");
  });

  it("rejects entry-count, per-entry and cumulative decompression quota violations", async () => {
    const entryCount = await createCodec({
      maxCompressedBytes: 1024 * 1024,
      maxEntries: 2,
      maxEntryUncompressedBytes: 1024,
      maxTotalUncompressedBytes: 4096,
    }).decode(
      zipSync({
        "one.txt": strToU8("1"),
        "two.txt": strToU8("2"),
        "three.txt": strToU8("3"),
      }),
    );
    expect(entryCount.ok).toBe(false);
    if (!entryCount.ok) expect(entryCount.error.code).toBe("too-many-entries");

    const perEntry = await createCodec({
      maxCompressedBytes: 1024 * 1024,
      maxEntries: 10,
      maxEntryUncompressedBytes: 16,
      maxTotalUncompressedBytes: 4096,
    }).decode(zipSync({ "large.txt": strToU8("x".repeat(64)) }));
    expect(perEntry.ok).toBe(false);
    if (!perEntry.ok) expect(perEntry.error.code).toBe("entry-too-large");

    const cumulative = await createCodec({
      maxCompressedBytes: 1024 * 1024,
      maxEntries: 10,
      maxEntryUncompressedBytes: 128,
      maxTotalUncompressedBytes: 80,
    }).decode(
      zipSync({
        "first.txt": strToU8("a".repeat(48)),
        "second.txt": strToU8("b".repeat(48)),
      }),
    );
    expect(cumulative.ok).toBe(false);
    if (!cumulative.ok) expect(cumulative.error.code).toBe("archive-too-large");
  });

  it("round-trips a non-empty Stage 09 mockup preset through .hawya", async () => {
    const hasher = new WebCryptoSha256Hasher();
    const fixture = await createSyntheticProjectFixture(hasher);
    const backgroundBytes = new TextEncoder().encode("hawya-stage09-mockup-background");
    const backgroundHash = await hasher.hash(backgroundBytes);
    const backgroundAssetId = "00000000-0000-4000-8000-000000000913";

    const snapshot = projectSnapshotSchema.parse({
      ...fixture.snapshot,
      project: {
        ...fixture.snapshot.project,
        assetRefs: [...fixture.snapshot.project.assetRefs, { assetId: backgroundAssetId }],
        mockups: {
          presets: [
            {
              id: "00000000-0000-4000-8000-000000000914",
              name: "Archive mockup",
              backgroundAssetId,
              crop: { x: 0.1, y: 0.05, width: 0.8, height: 0.9 },
              surface: {
                corners: cloneDefaultMockupQuad(),
                artwork: { kind: "asset", assetId: SYNTHETIC_LOGO_ASSET_ID },
                opacity: 0.9,
                blendMode: "multiply",
                shadowStrength: 0.2,
                highlightStrength: 0.1,
              },
              createdAt: SYNTHETIC_TIMESTAMP,
              updatedAt: SYNTHETIC_TIMESTAMP,
            },
          ],
        },
      },
      assets: [
        ...fixture.snapshot.assets,
        {
          id: backgroundAssetId,
          projectId: SYNTHETIC_PROJECT_ID,
          contentHash: backgroundHash,
          kind: "mockup",
          name: "Archive mockup background",
          originalFilename: "archive-mockup.png",
          mime: "image/png",
          extension: "png",
          byteLength: backgroundBytes.byteLength,
          createdAt: SYNTHETIC_TIMESTAMP,
          updatedAt: SYNTHETIC_TIMESTAMP,
          tags: ["stage-09"],
          metadata: { width: 32, height: 24 },
          binaryKey: backgroundHash,
          security: {},
        },
      ],
    });

    const encoded = await createCodec().encode({
      snapshot,
      binaries: [
        ...fixture.binaries,
        { contentHash: backgroundHash, mime: "image/png", bytes: backgroundBytes },
      ],
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) throw encoded.error;

    const decoded = await createCodec().decode(encoded.value);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw decoded.error;

    expect(decoded.value.snapshot.project.mockups).toEqual(snapshot.project.mockups);
    expect(decoded.value.snapshot.project.mockups.presets[0]?.surface?.artwork).toEqual({
      kind: "asset",
      assetId: SYNTHETIC_LOGO_ASSET_ID,
    });
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
