import { describe, expect, it } from "vitest";

import type { BinaryStore, StoredBinary } from "@/application/ports/binary-store";
import type {
  FontOutlineOptions,
  FontOutlineResult,
  FontOutliner,
} from "@/application/ports/font-outliner";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import {
  buildBrandGuidelinesMarkdown,
} from "@/infrastructure/export/brand-artifact-builders";
import { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_COLOR_ID,
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_TEXT_STYLE_ID,
} from "../../../tests/fixtures/stage02/synthetic-project";

class GoldenBinaryStore implements BinaryStore {
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

class GoldenOutliner implements FontOutliner {
  readonly calls: string[] = [];

  async outline(
    _bytes: Uint8Array,
    text: string,
    _options: FontOutlineOptions,
    _signal: AbortSignal,
  ): Promise<FontOutlineResult> {
    this.calls.push(text);
    return {
      glyphs: text
        ? [
            { pathData: "M0 0L600 0L600 700L0 700Z", x: 0, y: 0 },
            { pathData: "M700 0L900 0L900 700L700 700Z", x: 650, y: 0 },
          ]
        : [],
      unitsPerEm: 1000,
      ascent: 800,
      descent: -200,
      advanceWidth: text ? 950 : 0,
    };
  }
}

const GOLDENS = [
  {
    localeMode: "en",
    text: "Brand standards",
    direction: "ltr",
    language: "en",
    markdownHeadings: ["# Synthetic Identity", "### Colors", "### Typography"],
  },
  {
    localeMode: "ar",
    text: "معايير الهوية",
    direction: "rtl",
    language: "ar",
    markdownHeadings: ["# هوية تجريبية", "### الألوان", "### الطباعة والخطوط"],
  },
  {
    localeMode: "bilingual",
    text: "Brand standards — معايير الهوية",
    direction: "auto",
    language: "und",
    markdownHeadings: ["# Synthetic Identity", "# هوية تجريبية", "### Colors", "### الألوان"],
  },
] as const satisfies ReadonlyArray<{
  localeMode: TemplateLocaleMode;
  text: string;
  direction: "auto" | "ltr" | "rtl";
  language: string;
  markdownHeadings: readonly string[];
}>;

describe("Stage 08 locale semantic goldens", () => {
  for (const golden of GOLDENS) {
    it(`keeps ${golden.localeMode} text, direction, dimensions and outline semantics stable`, async () => {
      const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
      const page = fixture.snapshot.project.guide.pages[SYNTHETIC_PAGE_ID];
      if (!page) throw new Error("fixture page missing");

      const layerId =
        golden.localeMode === "en"
          ? "00000000-0000-4000-8000-000000000090"
          : golden.localeMode === "ar"
            ? "00000000-0000-4000-8000-000000000091"
            : "00000000-0000-4000-8000-000000000092";

      page.extras.push({
        id: layerId,
        name: `${golden.localeMode} golden text`,
        source: "extra",
        type: "text",
        visible: true,
        locked: false,
        opacity: 1,
        transform: {
          x: 120,
          y: 140,
          width: 620,
          height: 180,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        },
        content: golden.text,
        typography: { tokenId: SYNTHETIC_TEXT_STYLE_ID },
        fill: { colorTokenId: SYNTHETIC_COLOR_ID },
        alignment: golden.direction === "rtl" ? "end" : "start",
        verticalAlign: "top",
        direction: golden.direction,
        language: golden.language,
        overflow: "clip",
      });

      const values = new Map<string, StoredBinary>(
        fixture.binaries.map((binary) => [
          binary.contentHash,
          { ...binary, byteLength: binary.bytes.byteLength },
        ]),
      );
      const store = new GoldenBinaryStore(values);
      const outliner = new GoldenOutliner();
      const editable = new SvgExportRenderer(store, outliner, "editable");
      const outlined = new SvgExportRenderer(store, outliner, "outlined");
      const signal = new AbortController().signal;

      const [editableArtifact] = await editable.render(
        fixture.snapshot,
        { localeMode: golden.localeMode, pageIds: [SYNTHETIC_PAGE_ID] },
        signal,
      );
      const [outlinedArtifact] = await outlined.render(
        fixture.snapshot,
        { localeMode: golden.localeMode, pageIds: [SYNTHETIC_PAGE_ID] },
        signal,
      );

      const editableSvg = new TextDecoder().decode(editableArtifact?.bytes);
      const outlinedSvg = new TextDecoder().decode(outlinedArtifact?.bytes);
      const markdown = new TextDecoder().decode(
        buildBrandGuidelinesMarkdown(fixture.snapshot, golden.localeMode),
      );

      expect(editableSvg).toContain(
        `width="${page.canvas.width}${page.canvas.unit}" height="${page.canvas.height}${page.canvas.unit}"`,
      );
      expect(editableSvg).toContain(
        `viewBox="0 0 ${page.canvas.width} ${page.canvas.height}"`,
      );
      expect(editableSvg).toContain(`data-layer-id="${layerId}"`);
      expect(editableSvg).toContain(`direction="${golden.direction}"`);
      expect(editableSvg).toContain(golden.text);

      expect(outlinedSvg).toContain('data-hawya-export="outlined"');
      expect(outlinedSvg).toContain(`data-layer-id="${layerId}"`);
      expect(outlinedSvg).toContain("<path");
      expect(outlinedSvg).not.toContain(golden.text);
      expect(outliner.calls).toContain(golden.text);

      for (const output of [editableSvg, outlinedSvg]) {
        expect(output).not.toMatch(/<script\b/i);
        expect(output).not.toMatch(/<foreignObject\b/i);
        expect(output).not.toMatch(/href=["']https?:/i);
      }

      for (const heading of golden.markdownHeadings) {
        expect(markdown).toContain(heading);
      }
      expect(markdown).toContain("format: hawya-brand-guidelines");
      expect(markdown).toContain(`locales: ${JSON.stringify(
        golden.localeMode === "bilingual" ? ["en", "ar"] : [golden.localeMode],
      )}`);
    });
  }
});
