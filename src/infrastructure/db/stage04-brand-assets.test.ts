import { beforeEach, describe, expect, it } from "vitest";

import type { AssetSanitizer } from "@/application/ports/asset-sanitizer";
import type { FontAnalyzer } from "@/application/ports/font-analyzer";
import type { RasterAnalyzer } from "@/application/ports/raster-analyzer";
import { AssetIngestor } from "@/application/services/asset-ingestor";
import { GarbageCollectBinariesUseCase } from "@/application/use-cases/garbage-collect-binaries";
import { ManageColorTokensUseCase } from "@/application/use-cases/manage-color-tokens";
import { ReplaceAssetUseCase } from "@/application/use-cases/replace-asset";
import { resolveTextStyleColor } from "@/domain/brand/brand-references";
import { IndexedDbBinaryStore } from "@/infrastructure/binary-store/indexeddb-binary-store";
import { ColorJsColorEngine } from "@/infrastructure/analysis/color-js-color-engine";
import { DexieBinaryReferenceIndex } from "@/infrastructure/db/dexie-binary-reference-index";
import { DexieProjectRepository } from "@/infrastructure/db/dexie-project-repository";
import { HawyaDatabase } from "@/infrastructure/db/hawya-database";
import { CryptoIdGenerator } from "@/infrastructure/runtime/crypto-id-generator";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_COLOR_ID,
  SYNTHETIC_LOGO_ASSET_ID,
  SYNTHETIC_LOGO_VARIANT_ID,
  SYNTHETIC_PROJECT_ID,
  SYNTHETIC_TEXT_STYLE_ID,
} from "../../../tests/fixtures/stage02/synthetic-project";

class TestClock {
  now() {
    return "2026-09-20T00:00:00.000Z";
  }
}

const sanitizer: AssetSanitizer = {
  async sanitizeSvg(source) {
    return { svg: source, rejectedFeatures: [], metadata: { viewBox: "0 0 100 100" } };
  },
};

const fonts: FontAnalyzer = {
  async analyze() {
    throw new Error("not used by this test");
  },
};

const rasters: RasterAnalyzer = {
  async analyze() {
    throw new Error("not used by this test");
  },
};

describe("Stage 04 brand and asset invariants", () => {
  let database: HawyaDatabase;
  let projects: DexieProjectRepository;
  let binaries: IndexedDbBinaryStore;
  const clock = new TestClock();
  const hasher = new WebCryptoSha256Hasher();

  beforeEach(async () => {
    database = new HawyaDatabase(`stage04-${crypto.randomUUID()}`);
    projects = new DexieProjectRepository(database);
    binaries = new IndexedDbBinaryStore(database, clock);
    const fixture = await createSyntheticProjectFixture(hasher);
    for (const binary of fixture.binaries) await binaries.put(binary);
    await projects.save(fixture.snapshot);
  });

  it("propagates a global color-token update without copying values into consumers", async () => {
    const colors = new ManageColorTokensUseCase(
      projects,
      new ColorJsColorEngine(),
      clock,
      new CryptoIdGenerator(),
    );
    await colors.update(SYNTHETIC_PROJECT_ID, SYNTHETIC_COLOR_ID, {
      name: { en: "Ink" },
      role: "primary",
      srgbHex: "#224466",
    });
    const reloaded = await projects.get(SYNTHETIC_PROJECT_ID);
    expect(reloaded).toBeDefined();
    if (!reloaded) return;
    const style = reloaded.project.brand.typography.styles.find(
      (item) => item.id === SYNTHETIC_TEXT_STYLE_ID,
    );
    expect(style?.colorTokenId).toBe(SYNTHETIC_COLOR_ID);
    expect(
      style ? resolveTextStyleColor(style, reloaded.project.brand.colors.tokens) : undefined,
    ).toBe("#224466");
  });

  it("replaces asset bytes while preserving the stable AssetId and logo references", async () => {
    const references = new DexieBinaryReferenceIndex(database);
    const garbage = new GarbageCollectBinariesUseCase(binaries, references);
    const ingestor = new AssetIngestor(hasher, binaries, sanitizer, fonts, rasters, clock);
    const replace = new ReplaceAssetUseCase(projects, ingestor, garbage, clock);
    const before = await projects.get(SYNTHETIC_PROJECT_ID);
    const oldHash = before?.assets.find(
      (asset) => asset.id === SYNTHETIC_LOGO_ASSET_ID,
    )?.contentHash;

    await replace.execute(SYNTHETIC_PROJECT_ID, SYNTHETIC_LOGO_ASSET_ID, {
      bytes: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
      ),
      filename: "replacement.svg",
      declaredMime: "image/svg+xml",
      intendedKind: "logo",
    });

    const after = await projects.get(SYNTHETIC_PROJECT_ID);
    expect(after).toBeDefined();
    if (!after) return;
    const asset = after.assets.find((item) => item.id === SYNTHETIC_LOGO_ASSET_ID);
    const variant = after.project.brand.logos.variants.find(
      (item) => item.id === SYNTHETIC_LOGO_VARIANT_ID,
    );
    expect(asset?.id).toBe(SYNTHETIC_LOGO_ASSET_ID);
    expect(asset?.contentHash).not.toBe(oldHash);
    expect(variant?.assetId).toBe(SYNTHETIC_LOGO_ASSET_ID);
  });
});
