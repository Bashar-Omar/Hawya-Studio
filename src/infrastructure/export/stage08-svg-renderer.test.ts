import { describe, expect, it } from "vitest";

import type { BinaryStore, StoredBinary } from "@/application/ports/binary-store";
import type {
  FontOutlineOptions,
  FontOutlineResult,
  FontOutliner,
} from "@/application/ports/font-outliner";
import { createShapeLayer, groupExtraLayers } from "@/editor/model/page-operations";
import { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_COLOR_ID,
  SYNTHETIC_FONT_REF_ID,
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_TEXT_STYLE_ID,
} from "../../../tests/fixtures/stage02/synthetic-project";

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
  async delete() {
    throw new Error("not used");
  }
}

class FixtureOutliner implements FontOutliner {
  calls: Array<{ text: string; options: FontOutlineOptions }> = [];
  async outline(
    _bytes: Uint8Array,
    text: string,
    options: FontOutlineOptions,
    _signal: AbortSignal,
  ): Promise<FontOutlineResult> {
    this.calls.push({ text, options });
    return {
      glyphs: [{ pathData: "M0 0L500 0L500 500Z", x: 0, y: 0 }],
      unitsPerEm: 1000,
      ascent: 800,
      descent: -200,
      advanceWidth: 500,
    };
  }
}

describe("Stage 08 SVG renderer", () => {
  it("renders editable live text and outlined glyph paths from the same immutable scene", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const page = fixture.snapshot.project.guide.pages[SYNTHETIC_PAGE_ID];
    if (!page) throw new Error("fixture page missing");
    page.extras.push({
      id: "00000000-0000-4000-8000-000000000080",
      name: "Export sample",
      source: "extra",
      type: "text",
      visible: true,
      locked: false,
      opacity: 1,
      transform: { x: 100, y: 120, width: 500, height: 160, rotation: 0, scaleX: 1, scaleY: 1 },
      content: "Hello Hawya",
      typography: { tokenId: SYNTHETIC_TEXT_STYLE_ID },
      fill: { colorTokenId: SYNTHETIC_COLOR_ID },
      alignment: "start",
      verticalAlign: "top",
      direction: "ltr",
      language: "en",
      overflow: "clip",
    });
    const values = new Map<string, StoredBinary>(
      fixture.binaries.map((binary) => [
        binary.contentHash,
        { ...binary, byteLength: binary.bytes.byteLength },
      ]),
    );
    const outliner = new FixtureOutliner();
    const binaries = new FixtureBinaryStore(values);
    const editableRenderer = new SvgExportRenderer(binaries, outliner, "editable");
    const outlinedRenderer = new SvgExportRenderer(binaries, outliner, "outlined");
    const signal = new AbortController().signal;

    const editable = await editableRenderer.render(
      fixture.snapshot,
      { localeMode: "en", pageIds: [SYNTHETIC_PAGE_ID] },
      signal,
    );
    const outlined = await outlinedRenderer.render(
      fixture.snapshot,
      { localeMode: "en", pageIds: [SYNTHETIC_PAGE_ID] },
      signal,
    );
    const editableText = new TextDecoder().decode(editable[0]?.bytes);
    const outlinedText = new TextDecoder().decode(outlined[0]?.bytes);

    expect(editableText).toContain('data-hawya-export="editable"');
    expect(editableText).toContain("<text");
    expect(editableText).toContain("Hello Hawya");
    expect(outlinedText).toContain('data-hawya-export="outlined"');
    expect(outlinedText).toContain("<path");
    expect(outlinedText).not.toContain(">Hello Hawya<");
    expect(outliner.calls.some((call) => call.text === "Hello Hawya")).toBe(true);
    expect(fixture.snapshot.project.brand.typography.fonts[0]?.id).toBe(SYNTHETIC_FONT_REF_ID);
  });
  it("preserves grouped child transforms as nested SVG groups", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const page = fixture.snapshot.project.guide.pages[SYNTHETIC_PAGE_ID];
    if (!page) throw new Error("fixture page missing");

    const firstId = "00000000-0000-4000-8000-000000000081";
    const secondId = "00000000-0000-4000-8000-000000000082";
    const groupId = "00000000-0000-4000-8000-000000000083";
    page.extras.push(createShapeLayer(firstId, 100, 120), createShapeLayer(secondId, 400, 300));
    expect(groupExtraLayers(page, [firstId, secondId], groupId)).toBe(true);

    const values = new Map<string, StoredBinary>(
      fixture.binaries.map((binary) => [
        binary.contentHash,
        { ...binary, byteLength: binary.bytes.byteLength },
      ]),
    );
    const renderer = new SvgExportRenderer(
      new FixtureBinaryStore(values),
      new FixtureOutliner(),
      "editable",
    );
    const [artifact] = await renderer.render(
      fixture.snapshot,
      { localeMode: "en", pageIds: [SYNTHETIC_PAGE_ID] },
      new AbortController().signal,
    );
    const output = new TextDecoder().decode(artifact?.bytes);
    const groupIndex = output.indexOf(`data-layer-id="${groupId}"`);
    const firstIndex = output.indexOf(`data-layer-id="${firstId}"`);
    const secondIndex = output.indexOf(`data-layer-id="${secondId}"`);

    expect(groupIndex).toBeGreaterThan(-1);
    expect(firstIndex).toBeGreaterThan(groupIndex);
    expect(secondIndex).toBeGreaterThan(groupIndex);
    expect(output).toContain(
      `data-layer-id="${firstId}" opacity="1" transform="translate(90 60) rotate(0) scale(1 1) translate(-90 -60)"`,
    );
  });

});
