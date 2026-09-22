import { describe, expect, it } from "vitest";

import type { ArchiveEntry, ArchivePackager } from "@/application/ports/archive-packager";
import type { BinaryStore, StoredBinary } from "@/application/ports/binary-store";
import type {
  FontOutlineOptions,
  FontOutlineResult,
  FontOutliner,
} from "@/application/ports/font-outliner";
import {
  buildBrandGuidelinesMarkdown,
  buildCssVariables,
  buildDesignTokensJson,
} from "@/infrastructure/export/brand-artifact-builders";
import {
  DEFAULT_DELIVERY_SELECTION,
  DeliveryExportRenderer,
  WebGuideExportRenderer,
} from "@/infrastructure/export/package-export-renderers";
import { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import { createSyntheticProjectFixture } from "../../../tests/fixtures/stage02/synthetic-project";

class FixtureBinaryStore implements BinaryStore {
  constructor(private readonly values: ReadonlyMap<string, StoredBinary>) {}
  async has(contentHash: string) {
    return this.values.has(contentHash);
  }
  async get(contentHash: string) {
    return this.values.get(contentHash);
  }
  async put() {
    return { inserted: false };
  }
  async listContentHashes() {
    return [...this.values.keys()];
  }
  async delete() {}
}

class FixtureOutliner implements FontOutliner {
  async outline(
    _bytes: Uint8Array,
    text: string,
    _options: FontOutlineOptions,
    _signal: AbortSignal,
  ): Promise<FontOutlineResult> {
    return {
      glyphs: text ? [{ pathData: "M0 0L500 0L500 500Z", x: 0, y: 0 }] : [],
      unitsPerEm: 1000,
      ascent: 800,
      descent: -200,
      advanceWidth: text ? 500 : 0,
    };
  }
}

class CapturingPackager implements ArchivePackager {
  entries: ArchiveEntry[] = [];
  async pack(entries: readonly ArchiveEntry[]) {
    this.entries = entries.map((entry) => ({ path: entry.path, bytes: entry.bytes }));
    return new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  }
}

describe("Stage 08 developer and package exports", () => {
  it("emits deterministic machine tokens, digital CSS and bilingual Markdown without invented filler", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const tokens = new TextDecoder().decode(buildDesignTokensJson(fixture.snapshot));
    const css = new TextDecoder().decode(buildCssVariables(fixture.snapshot));
    const markdown = new TextDecoder().decode(
      buildBrandGuidelinesMarkdown(fixture.snapshot, "bilingual"),
    );

    expect(tokens).toContain('"format": "hawya-brand-tokens"');
    expect(tokens).toContain('"enabled"');
    expect(tokens).toContain('"assets"');
    expect(tokens).toContain('"srgb": "#111111"');
    expect(css).toContain("--hawya-color-primary-");
    expect(css).toContain("#111111");
    expect(css).not.toContain("CMYK");
    expect(markdown).toContain("---\nformat: hawya-brand-guidelines\nversion: 1");
    expect(markdown).toContain('locales: ["en","ar"]');
    expect(markdown).toContain("# Synthetic Identity");
    expect(markdown).toContain("# هوية تجريبية");
    expect(markdown).toContain("### Colors");
    expect(markdown).toContain("### الألوان");
    expect(markdown).toContain("## Asset map");
  });

  it("uses generated archive paths and omits font binaries unless the user explicitly confirmed inclusion", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const values = new Map<string, StoredBinary>(
      fixture.binaries.map((binary) => [
        binary.contentHash,
        { ...binary, byteLength: binary.bytes.byteLength },
      ]),
    );
    const binaries = new FixtureBinaryStore(values);
    const outliner = new FixtureOutliner();
    const outlined = new SvgExportRenderer(binaries, outliner, "outlined");
    const editable = new SvgExportRenderer(binaries, outliner, "editable");
    const omitPackager = new CapturingPackager();
    const includePackager = new CapturingPackager();
    const signal = new AbortController().signal;

    const web = new WebGuideExportRenderer(omitPackager, outlined, binaries);
    await web.render(fixture.snapshot, { localeMode: "bilingual", fontPolicy: "omit" }, signal);

    expect(omitPackager.entries.some((entry) => entry.path === "index.html")).toBe(true);
    expect(omitPackager.entries.some((entry) => entry.path.startsWith("assets/pages/page-"))).toBe(
      true,
    );
    expect(omitPackager.entries.some((entry) => entry.path === "data/brand.json")).toBe(true);
    expect(omitPackager.entries.some((entry) => entry.path === "DEPLOY.md")).toBe(true);
    expect(omitPackager.entries.some((entry) => entry.path.startsWith("fonts/"))).toBe(false);
    expect(
      omitPackager.entries.every(
        (entry) => !entry.path.includes("..") && !entry.path.includes("\\"),
      ),
    ).toBe(true);

    const delivery = new DeliveryExportRenderer(includePackager, editable, outlined, binaries);
    await delivery.render(
      fixture.snapshot,
      {
        localeMode: "en",
        fontPolicy: "include-confirmed",
        include: {
          ...DEFAULT_DELIVERY_SELECTION,
          fonts: true,
          sourceAttachments: true,
        },
        exportedAt: "2026-09-22T00:00:00.000Z",
        appVersion: "0.1.0-test",
      },
      signal,
    );

    expect(includePackager.entries.some((entry) => entry.path.startsWith("Fonts/font-"))).toBe(
      true,
    );
    expect(
      includePackager.entries.some((entry) =>
        entry.path.includes(fixture.snapshot.assets[0]?.originalFilename ?? "logo.svg"),
      ),
    ).toBe(false);
    expect(includePackager.entries.some((entry) => entry.path === "manifest.json")).toBe(true);
    const manifestEntry = includePackager.entries.find((entry) => entry.path === "manifest.json");
    const readmeEntry = includePackager.entries.find((entry) => entry.path === "README.txt");
    expect(manifestEntry).toBeDefined();
    expect(readmeEntry).toBeDefined();
    const manifestText = new TextDecoder().decode(manifestEntry?.bytes);
    const readmeText = new TextDecoder().decode(readmeEntry?.bytes);
    expect(manifestText).toContain('"exportedAt": "2026-09-22T00:00:00.000Z"');
    expect(manifestText).toContain('"hawyaVersion": "0.1.0-test"');
    expect(readmeText).toContain("Hawya Studio version: 0.1.0-test");
    expect(readmeText).toContain("Exported at: 2026-09-22T00:00:00.000Z");
    expect(
      includePackager.entries.some((entry) => entry.path.startsWith("Artwork/Editable/page-")),
    ).toBe(true);
    expect(
      includePackager.entries.some((entry) => entry.path.startsWith("Artwork/Outlined/page-")),
    ).toBe(true);
    expect(
      includePackager.entries.some((entry) => entry.path === "Guidelines/Brand-Guidelines.md"),
    ).toBe(true);
    expect(includePackager.entries.some((entry) => entry.path === "Colors/brand-tokens.json")).toBe(
      true,
    );
    const binaryPaths = includePackager.entries.filter(
      (entry) =>
        entry.path.startsWith("Fonts/") ||
        entry.path.startsWith("Logos/") ||
        entry.path.startsWith("Source-Attachments/"),
    );
    expect(new Set(binaryPaths.map((entry) => entry.path)).size).toBe(binaryPaths.length);
  });
});
