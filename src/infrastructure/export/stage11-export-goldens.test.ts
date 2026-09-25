import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { BinaryPayload, BinaryStore, StoredBinary } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type { ContentHasher } from "@/application/ports/content-hasher";
import type { FontOutlineOptions, FontOutlineResult, FontOutliner } from "@/application/ports/font-outliner";
import { buildAuditReport } from "@/domain/audit/audit-engine";
import { type ISODateTime, isoDateTimeSchema } from "@/domain/common/primitives";
import { runExportPreflight } from "@/domain/export/export-preflight";
import { type ProjectSnapshot, projectSnapshotSchema } from "@/domain/project/hawya-project";
import { migrateProjectSnapshot } from "@/domain/project/migrations";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/domain/project/schema-version";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import { archiveChecksumsSchema, hawyaArchiveManifestSchema } from "@/infrastructure/archive/project-archive-schema";
import { bytesToBase64 } from "@/infrastructure/export/export-helpers";
import { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  SYNTHETIC_COLOR_ID,
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_PROJECT_ID,
  SYNTHETIC_SAVE_TIMESTAMP,
  SYNTHETIC_TEXT_STYLE_ID,
  SYNTHETIC_TIMESTAMP,
  createSyntheticProjectFixture,
} from "../../../tests/fixtures/stage02/synthetic-project";
import legacyV1Json from "../../../tests/fixtures/stage11/legacy-v1.json?raw";

const IDS = {
  latin: "00000000-0000-4000-8000-000000001101",
  arabic: "00000000-0000-4000-8000-000000001102",
  bilingual: "00000000-0000-4000-8000-000000001103",
  variable: "00000000-0000-4000-8000-000000001104",
  missingLayer: "00000000-0000-4000-8000-000000001105",
  missingAsset: "00000000-0000-4000-8000-000000001106",
  gradientAsset: "00000000-0000-4000-8000-000000001107",
  gradientLayer: "00000000-0000-4000-8000-000000001108",
} as const;
const GRADIENT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><defs><linearGradient id="stage11-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#112233"/><stop offset="1" stop-color="#F2C14E"/></linearGradient></defs><rect width="240" height="120" rx="18" fill="url(#stage11-gradient)"/></svg>';

type GoldenId = "latin-minimal" | "arabic-minimal" | "bilingual-standard" | "variable-font-axis" | "missing-asset-warning" | "complex-svg-gradient" | "legacy-schema-migration";
interface GoldenProject {
  id: GoldenId;
  localeMode: TemplateLocaleMode;
  snapshot: ProjectSnapshot;
  binaries: BinaryPayload[];
  text?: { id: string; value: string; direction: "auto" | "ltr" | "rtl" };
}

function addText(snapshot: ProjectSnapshot, id: string, value: string, direction: "auto" | "ltr" | "rtl", language: string) {
  const page = snapshot.project.guide.pages[SYNTHETIC_PAGE_ID];
  if (!page) throw new Error("Stage 11 golden fixture page is missing");
  page.extras.push({
    id,
    name: "Stage 11 golden text",
    source: "extra",
    type: "text",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 120, y: 140, width: 720, height: 180, rotation: 0, scaleX: 1, scaleY: 1 },
    content: value,
    typography: { tokenId: SYNTHETIC_TEXT_STYLE_ID },
    fill: { colorTokenId: SYNTHETIC_COLOR_ID },
    alignment: direction === "rtl" ? "end" : "start",
    verticalAlign: "top",
    direction,
    language,
    overflow: "clip",
  });
}

async function buildGoldens(hasher: ContentHasher): Promise<GoldenProject[]> {
  const base = await createSyntheticProjectFixture(hasher);
  const makeText = (id: GoldenId, localeMode: TemplateLocaleMode, layerId: string, value: string, direction: "auto" | "ltr" | "rtl", language: string, profile: "minimal" | "standard") => {
    const draft = structuredClone(base.snapshot);
    draft.project.metadata.name = "Stage 11 " + id;
    draft.project.settings.guideProfile = profile;
    draft.project.settings.enabledContentLocales = localeMode === "bilingual" ? ["en", "ar"] : [localeMode];
    draft.project.settings.defaultContentLocale = localeMode === "ar" ? "ar" : "en";
    draft.project.settings.defaultDirection = localeMode === "ar" ? "rtl" : "ltr";
    addText(draft, layerId, value, direction, language);
    return { id, localeMode, snapshot: projectSnapshotSchema.parse(draft), binaries: base.binaries, text: { id: layerId, value, direction } } satisfies GoldenProject;
  };

  const latin = makeText("latin-minimal", "en", IDS.latin, "Identity basics — ABC 123", "ltr", "en", "minimal");
  const arabic = makeText("arabic-minimal", "ar", IDS.arabic, "أساسيات الهوية — ١٢٣", "rtl", "ar", "minimal");
  const bilingual = makeText("bilingual-standard", "bilingual", IDS.bilingual, "Brand system — نظام الهوية — 2026 / ٢٠٢٦", "auto", "und", "standard");
  const variable = makeText("variable-font-axis", "en", IDS.variable, "Variable weight 650", "ltr", "en", "standard");
  const variableFont = variable.snapshot.project.brand.typography.fonts[0];
  const variableStyle = variable.snapshot.project.brand.typography.styles[0];
  if (!variableFont || !variableStyle) throw new Error("Stage 11 variable-font fixture is incomplete");
  variableFont.variableAxes = [{ tag: "wght", min: 100, default: 400, max: 900 }];
  variableStyle.fontWeight = 650;
  variable.snapshot = projectSnapshotSchema.parse(variable.snapshot);

  const missingDraft = structuredClone(base.snapshot);
  missingDraft.project.metadata.name = "Stage 11 missing-asset-warning";
  const missingPage = missingDraft.project.guide.pages[SYNTHETIC_PAGE_ID];
  if (!missingPage) throw new Error("Stage 11 missing-asset fixture page is missing");
  missingPage.extras.push({ id: IDS.missingLayer, name: "Missing artwork", source: "extra", type: "image", visible: true, locked: false, opacity: 1, transform: { x: 80, y: 80, width: 320, height: 220, rotation: 0, scaleX: 1, scaleY: 1 }, assetId: IDS.missingAsset, fit: "contain" });
  const missing: GoldenProject = { id: "missing-asset-warning", localeMode: "en", snapshot: projectSnapshotSchema.parse(missingDraft), binaries: base.binaries };

  const gradientBytes = new TextEncoder().encode(GRADIENT_SVG);
  const gradientHash = await hasher.hash(gradientBytes);
  const gradientDraft = structuredClone(base.snapshot);
  gradientDraft.project.metadata.name = "Stage 11 complex-svg-gradient";
  gradientDraft.project.assetRefs.push({ assetId: IDS.gradientAsset });
  gradientDraft.assets.push({ id: IDS.gradientAsset, projectId: SYNTHETIC_PROJECT_ID, contentHash: gradientHash, kind: "vector", name: "Stage 11 gradient artwork", originalFilename: "stage11-gradient.svg", mime: "image/svg+xml", extension: "svg", byteLength: gradientBytes.byteLength, createdAt: SYNTHETIC_TIMESTAMP, updatedAt: SYNTHETIC_TIMESTAMP, tags: ["stage-11", "golden"], metadata: { viewBox: "0 0 240 120" }, binaryKey: gradientHash, security: { sanitized: true } });
  const gradientPage = gradientDraft.project.guide.pages[SYNTHETIC_PAGE_ID];
  if (!gradientPage) throw new Error("Stage 11 gradient fixture page is missing");
  gradientPage.extras.push({ id: IDS.gradientLayer, name: "Gradient artwork", source: "extra", type: "vector", visible: true, locked: false, opacity: 1, transform: { x: 160, y: 180, width: 480, height: 240, rotation: 0, scaleX: 1, scaleY: 1 }, data: { assetId: IDS.gradientAsset } });
  const gradient: GoldenProject = { id: "complex-svg-gradient", localeMode: "en", snapshot: projectSnapshotSchema.parse(gradientDraft), binaries: [...base.binaries, { contentHash: gradientHash, mime: "image/svg+xml", bytes: gradientBytes }] };

  const legacy: GoldenProject = { id: "legacy-schema-migration", localeMode: "en", snapshot: migrateProjectSnapshot(JSON.parse(legacyV1Json) as unknown), binaries: base.binaries };
  return [latin, arabic, bilingual, variable, missing, gradient, legacy];
}

class MemoryBinaryStore implements BinaryStore {
  constructor(private readonly values: ReadonlyMap<string, StoredBinary>) {}
  async has(hash: string) { return this.values.has(hash); }
  async get(hash: string) { return this.values.get(hash); }
  async put() { return { inserted: false }; }
  async listContentHashes() { return [...this.values.keys()]; }
  async delete() {}
}
class GoldenOutliner implements FontOutliner {
  readonly calls: string[] = [];
  async outline(_bytes: Uint8Array, text: string, _options: FontOutlineOptions, _signal: AbortSignal): Promise<FontOutlineResult> {
    this.calls.push(text);
    return { glyphs: text ? [{ pathData: "M0 0L600 0L600 700L0 700Z", x: 0, y: 0 }] : [], unitsPerEm: 1000, ascent: 800, descent: -200, advanceWidth: text ? 600 : 0 };
  }
}
class FixedClock implements Clock {
  private readonly value = isoDateTimeSchema.parse(SYNTHETIC_SAVE_TIMESTAMP);
  now(): ISODateTime { return this.value; }
}
function store(project: GoldenProject) {
  return new MemoryBinaryStore(new Map(project.binaries.map((binary) => [binary.contentHash, { ...binary, byteLength: binary.bytes.byteLength }])));
}

async function assertArchive(project: GoldenProject) {
  const hasher = new WebCryptoSha256Hasher();
  const codec = new FflateProjectArchiveCodec(hasher, new FixedClock());
  const encoded = await codec.encode({ snapshot: project.snapshot, binaries: project.binaries });
  expect(encoded.ok).toBe(true);
  if (!encoded.ok) throw encoded.error;
  const entries = unzipSync(encoded.value);
  const manifestBytes = entries["manifest.json"];
  const projectBytes = entries["project.json"];
  const checksumsBytes = entries["checksums.json"];
  if (!manifestBytes || !projectBytes || !checksumsBytes) throw new Error("Stage 11 archive critical entry missing: " + project.id);
  const manifest = hawyaArchiveManifestSchema.parse(JSON.parse(strFromU8(manifestBytes)));
  const checksums = archiveChecksumsSchema.parse(JSON.parse(strFromU8(checksumsBytes)));
  expect(manifest.projectId).toBe(project.snapshot.project.id);
  expect(manifest.projectName).toBe(project.snapshot.project.metadata.name);
  expect(checksums.entries["project.json"]).toBe(await hasher.hash(projectBytes));
  for (const [path, expectedHash] of Object.entries(checksums.entries)) {
    const bytes = entries[path];
    expect(bytes, project.id + " checksummed entry " + path).toBeDefined();
    if (bytes) expect(await hasher.hash(bytes)).toBe(expectedHash);
  }
  const decoded = await codec.decode(encoded.value);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) throw decoded.error;
  expect(decoded.value.snapshot).toEqual(project.snapshot);
  ex