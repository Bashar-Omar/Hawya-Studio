import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { BinaryStore, StoredBinary } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type {
  FontOutlineOptions,
  FontOutlineResult,
  FontOutliner,
} from "@/application/ports/font-outliner";
import { buildAuditReport } from "@/domain/audit/audit-engine";
import { type ISODateTime, isoDateTimeSchema } from "@/domain/common/primitives";
import { runExportPreflight } from "@/domain/export/export-preflight";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/domain/project/schema-version";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import {
  archiveChecksumsSchema,
  hawyaArchiveManifestSchema,
} from "@/infrastructure/archive/project-archive-schema";
import { bytesToBase64 } from "@/infrastructure/export/export-helpers";
import { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  STAGE11_GRADIENT_LAYER_ID,
  STAGE11_GRADIENT_SVG,
  createStage11ExportGoldenProjects,
  type Stage11ExportGoldenProject,
} from "../../../tests/fixtures/stage11/export-golden-projects";
import {
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_SAVE_TIMESTAMP,
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
  readonly calls: Array<{ text: string; options: FontOutlineOptions }> = [];

  async outline(
    _bytes: Uint8Array,
    text: string,
    options: FontOutlineOptions,
    _signal: AbortSignal,
  ): Promise<FontOutlineResult> {
    this.calls.push({ text, options });
    return {
      glyphs: text ? [{ pathData: "M0 0L600 0L600 700L0 700Z", x: 0, y: 0 }] : [],
      unitsPerEm: 1000,
      ascent: 800,
      descent: -200,
      advanceWidth: text ? 600 : 0,
    };
  }
}

class FixedClock implements Clock {
  private readonly value = isoDateTimeSchema.parse(SYNTHETIC_SAVE_TIMESTAMP);

  now(): ISODateTime {
    return this.value;
  }
}

function binaryStore(project: Stage11ExportGoldenProject): GoldenBinaryStore {
  return new GoldenBinaryStore(
    new Map(
      project.binaries.map((binary) => [
        binary.contentHash,
        { ...binary, byteLength: binary.bytes.byteLength },
      ]),
    ),
  );
}

async function expectArchiveRoundTrip(project: Stage11ExportGoldenProject): Promise<void> {
  const hasher = new WebCryptoSha256Hasher();
  const codec = new FflateProjectArchiveCodec(hasher, new FixedClock());
  const encoded = await codec.encode({ snapshot: project.snapshot, binaries: project.binaries });
  expect(encoded.ok).toBe(true);
  if (!encoded.ok) throw encoded.error;

  const entries = unzipSync(encoded.value);
  expect(Object.keys(entries).sort()).toEqual(
    expect.arrayContaining(["README.txt", "checksums.json", "manifest.json", "project.json"]),
  );

  const manifestBytes = entries["manifest.json"];
  const projectBytes = entries["project.json"];
  const checksumsBytes = entries["checksums.json"];
  if (!manifestBytes || !projectBytes || !checksumsBytes) {
    throw new Error(`Stage 11 ${project.id} archive is missing a critical root entry`);
  }

  const manifest = hawyaArchiveManifestSchema.parse(JSON.parse(strFromU8(manifestBytes)));
  const checksums = archiveChecksumsSchema.parse(JSON.parse(strFromU8(checksumsBytes)));
  expect(manifest.projectId).toBe(project.snapshot.project.id);
  expect(manifest.projectName).toBe(project.snapshot.project.metadata.name);
  expect(manifest.entry).toBe("project.json");
  expect(checksums.entries["project.json"]).toBe(await hasher.hash(projectBytes));

  for (const [path, expectedHash] of Object.entries(checksums.entries)) {
    const bytes = entries[path];
    expect(bytes, `${project.id} checksummed entry ${path}`).toBeDefined();
    if (bytes) expect(await hasher.hash(bytes)).toBe(expectedHash);
  }

  const decoded = await codec.decode(encoded.value);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) throw decoded.error;
  expect(decoded.value.snapshot).toEqual(project.snapshot);

  const expectedBinaries = new Map(project.binaries.map((binary) => [binary.contentHash, binary]));
  expect(decoded.value.binaries.map((binary) => binary.contentHash).sort()).toEqual(
    [...expectedBinaries.keys()].sort(),
  );
  for (const binary of decoded.value.binaries) {
    const expected = expectedBinaries.get(binary.contentHash);
    expect(expected).toBeDefined();
    expect(binary.mime).toBe(expected?.mime);
    expect(binary.bytes).toEqual(expected?.bytes);
  }
}

describe("Stage 11 export semantic golden matrix", () => {
  it("covers every required golden project and round-trips its portable archive semantics", async () => {
    const projects = await createStage11ExportGoldenProjects(new WebCryptoSha256Hasher());
    expect(projects.map((project) => project.id)).toEqual([
      "latin-minimal",
      "arabic-minimal",
      "bilingual-standard",
      "variable-font-axis",
      "missing-asset-warning",
      "complex-svg-gradient",
      "legacy-schema-migration",
    ]);

    for (const project of projects) {
      expect(project.snapshot.project.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
      await expectArchiveRoundTrip(project);
    }
  });

  it("keeps Latin, Arabic and bilingual SVG text semantics stable without executable markup", async () => {
    const projects = await createStage11ExportGoldenProjects(new WebCryptoSha256Hasher());
    const textProjects = projects.filter((project) => project.textLayerId && project.expectedText);

    for (const project of textProjects) {
      const outliner = new GoldenOutliner();
      const editable = new SvgExportRenderer(binaryStore(project), outliner, "editable");
      const outlined = new SvgExportRenderer(binaryStore(project), outliner, "outlined");
      const options = { localeMode: project.localeMode, pageIds: [SYNTHETIC_PAGE_ID] } as const;
      const signal = new AbortController().signal;
      const [editableArtifact] = await editable.render(project.snapshot, options, signal);
      const [outlinedArtifact] = await outlined.render(project.snapshot, options, signal);
      const editableSvg = new TextDecoder().decode(editableArtifact?.bytes);
      const outlinedSvg = new TextDecoder().decode(outlinedArtifact?.bytes);

      expect(editableSvg).toContain('viewBox="0 0 1200 675"');
      expect(editableSvg).toContain(`data-layer-id="${project.textLayerId}"`);
      expect(editableSvg).toContain(`direction="${project.expectedDirection}"`);
      expect(editableSvg).toContain(project.expectedText);
      expect(outlinedSvg).toContain('data-hawya-export="outlined"');
      expect(outlinedSvg).toContain(`data-layer-id="${project.textLayerId}"`);
      expect(outlinedSvg).not.toContain(project.expectedText);
      expect(outliner.calls.some((call) => call.text === project.expectedText)).toBe(true);

      for (const output of [editableSvg, outlinedSvg]) {
        expect(output).not.toMatch(/<script\b/i);
        expect(output).not.toMatch(/<foreignObject\b/i);
        expect(output).not.toMatch(/href=["']https?:/i);
      }
    }
  });

  it("preserves the variable weight axis metadata and selected semantic weight", async () => {
    const projects = await createStage11ExportGoldenProjects(new WebCryptoSha256Hasher());
    const project = projects.find((candidate) => candidate.id === "variable-font-axis");
    if (!project) throw new Error("Stage 11 variable-font golden is missing");

    const font = project.snapshot.project.brand.typography.fonts[0];
    const style = project.snapshot.project.brand.typography.styles[0];
    expect(font?.variableAxes).toEqual([{ tag: "wght", min: 100, default: 400, max: 900 }]);
    expect(style?.fontWeight).toBe(650);

    const renderer = new SvgExportRenderer(binaryStore(project), new GoldenOutliner(), "editable");
    const [artifact] = await renderer.render(
      project.snapshot,
      { localeMode: "en", pageIds: [SYNTHETIC_PAGE_ID] },
      new AbortController().signal,
    );
    const svg = new TextDecoder().decode(artifact?.bytes);
    expect(svg).toContain('font-weight="650"');
  });

  it("preserves a local complex SVG gradient payload without introducing external references", async () => {
    const projects = await createStage11ExportGoldenProjects(new WebCryptoSha256Hasher());
    const project = projects.find((candidate) => candidate.id === "complex-svg-gradient");
    if (!project) throw new Error("Stage 11 complex SVG golden is missing");

    const renderer = new SvgExportRenderer(binaryStore(project), new GoldenOutliner(), "editable");
    const [artifact] = await renderer.render(
      project.snapshot,
      { localeMode: "en", pageIds: [SYNTHETIC_PAGE_ID] },
      new AbortController().signal,
    );
    const svg = new TextDecoder().decode(artifact?.bytes);
    const gradientBytes = new TextEncoder().encode(STAGE11_GRADIENT_SVG);

    expect(svg).toContain(`data:image/svg+xml;base64,${bytesToBase64(gradientBytes)}`);
    expect(svg).toContain(`data-layer-id="${STAGE11_GRADIENT_LAYER_ID}"`);
    expect(STAGE11_GRADIENT_SVG).toContain('linearGradient id="stage11-gradient"');
    expect(STAGE11_GRADIENT_SVG).not.toMatch(/<script\b|<foreignObject\b|https?:\/\//i);
  });

  it("blocks artwork export for a missing layer asset while keeping .hawya emergency portability available", async () => {
    const projects = await createStage11ExportGoldenProjects(new WebCryptoSha256Hasher());
    const project = projects.find((candidate) => candidate.id === "missing-asset-warning");
    if (!project) throw new Error("Stage 11 missing-asset golden is missing");

    const available = new Set(project.binaries.map((binary) => binary.contentHash));
    const audit = buildAuditReport(project.snapshot, { has: (hash) => available.has(hash) });
    expect(audit.issues.some((issue) => issue.code === "missing-layer-asset")).toBe(true);

    const artwork = runExportPreflight({
      snapshot: project.snapshot,
      audit,
      availableBinaryHashes: available,
      format: "svg-editable",
    });
    expect(artwork.ok).toBe(false);
    expect(artwork.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "audit.missing-layer-asset", severity: "blocking" }),
      ]),
    );

    const backup = runExportPreflight({
      snapshot: project.snapshot,
      audit,
      availableBinaryHashes: available,
      format: "hawya",
    });
    expect(backup.ok).toBe(true);
    expect(backup.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "audit.missing-layer-asset", severity: "warning" }),
      ]),
    );
  });
});
