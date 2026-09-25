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
  if (!variableFont || !variableStyle) t