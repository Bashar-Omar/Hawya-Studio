import type { BinaryPayload } from "@/application/ports/binary-store";
import type { ContentHasher } from "@/application/ports/content-hasher";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import {
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";
import { migrateProjectSnapshot } from "@/domain/project/migrations";
import {
  SYNTHETIC_COLOR_ID,
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_PROJECT_ID,
  SYNTHETIC_TEXT_STYLE_ID,
  SYNTHETIC_TIMESTAMP,
  createSyntheticProjectFixture,
} from "../stage02/synthetic-project";
import legacyV1Json from "./legacy-v1.json?raw";

const LATIN_LAYER_ID = "00000000-0000-4000-8000-000000001101";
const ARABIC_LAYER_ID = "00000000-0000-4000-8000-000000001102";
const BILINGUAL_LAYER_ID = "00000000-0000-4000-8000-000000001103";
const VARIABLE_LAYER_ID = "00000000-0000-4000-8000-000000001104";
const MISSING_LAYER_ID = "00000000-0000-4000-8000-000000001105";
const MISSING_ASSET_ID = "00000000-0000-4000-8000-000000001106";
const GRADIENT_ASSET_ID = "00000000-0000-4000-8000-000000001107";
export const STAGE11_GRADIENT_LAYER_ID = "00000000-0000-4000-8000-000000001108";

export const STAGE11_GRADIENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><defs><linearGradient id="stage11-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#112233"/><stop offset="1" stop-color="#F2C14E"/></linearGradient></defs><rect width="240" height="120" rx="18" fill="url(#stage11-gradient)"/></svg>`;

export interface Stage11ExportGoldenProject {
  id:
    | "latin-minimal"
    | "arabic-minimal"
    | "bilingual-standard"
    | "variable-font-axis"
    | "missing-asset-warning"
    | "complex-svg-gradient"
    | "legacy-schema-migration";
  localeMode: TemplateLocaleMode;
  snapshot: ProjectSnapshot;
  binaries: BinaryPayload[];
  textLayerId?: string;
  expectedText?: string;
  expectedDirection?: "auto" | "ltr" | "rtl";
  gradientAssetId?: string;
}

function withTextLayer(
  snapshot: ProjectSnapshot,
  input: {
    id: string;
    text: string;
    direction: "auto" | "ltr" | "rtl";
    language: string;
  },
): ProjectSnapshot {
  const draft = structuredClone(snapshot);
  const page = draft.project.guide.pages[SYNTHETIC_PAGE_ID];
  if (!page) throw new Error("Stage 11 golden fixture page is missing");
  page.extras.push({
    id: input.id,
    name: `Stage 11 ${input.language} golden`,
    source: "extra",
    type: "text",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 120, y: 140, width: 720, height: 180, rotation: 0, scaleX: 1, scaleY: 1 },
    content: input.text,
    typography: { tokenId: SYNTHETIC_TEXT_STYLE_ID },
    fill: { colorTokenId: SYNTHETIC_COLOR_ID },
    alignment: input.direction === "rtl" ? "end" : "start",
    verticalAlign: "top",
    direction: input.direction,
    language: input.language,
    overflow: "clip",
  });
  return projectSnapshotSchema.parse(draft);
}

export async function createStage11ExportGoldenProjects(
  hasher: ContentHasher,
): Promise<Stage11ExportGoldenProject[]> {
  const base = await createSyntheticProjectFixture(hasher);

  const latinDraft = structuredClone(base.snapshot);
  latinDraft.project.metadata.name = "Stage 11 Latin Minimal";
  latinDraft.project.settings.guideProfile = "minimal";
  latinDraft.project.settings.defaultContentLocale = "en";
  latinDraft.project.settings.enabledContentLocales = ["en"];
  latinDraft.project.settings.defaultDirection = "ltr";
  const latin = withTextLayer(latinDraft, {
    id: LATIN_LAYER_ID,
    text: "Identity basics — ABC 123",
    direction: "ltr",
    language: "en",
  });

  const arabicDraft = structuredClone(base.snapshot);
  arabicDraft.project.metadata.name = "Stage 11 Arabic Minimal";
  arabicDraft.project.settings.guideProfile = "minimal";
  arabicDraft.project.settings.defaultContentLocale = "ar";
  arabicDraft.project.settings.enabledContentLocales = ["ar"];
  arabicDraft.project.settings.defaultDirection = "rtl";
  const arabic = withTextLayer(arabicDraft, {
    id: ARABIC_LAYER_ID,
    text: "أساسيات الهوية — ١٢٣",
    direction: "rtl",
    language: "ar",
  });

  const bilingualDraft = structuredClone(base.snapshot);
  bilingualDraft.project.metadata.name = "Stage 11 Bilingual Standard";
  bilingualDraft.project.settings.guideProfile = "standard";
  bilingualDraft.project.settings.enabledContentLocales = ["en", "ar"];
  const bilingual = withTextLayer(bilingualDraft, {
    id: BILINGUAL_LAYER_ID,
    text: "Brand system — نظام الهوية — 2026 / ٢٠٢٦",
    direction: "auto",
    language: "und",
  });

  const variableDraft = structuredClone(base.snapshot);
  variableDraft.project.metadata.name = "Stage 11 Variable Font Axis";
  const variableFont = variableDraft.project.brand.typography.fonts[0];
  const variableStyle = variableDraft.project.brand.typography.styles[0];
  if (!variableFont || !variableStyle)
    throw new Error("Stage 11 variable-font fixture is incomplete");
  variableFont.variableAxes = [{ tag: "wght", min: 100, default: 400, max: 900 }];
  variableStyle.fontWeight = 650;
  const variable = withTextLayer(variableDraft, {
    id: VARIABLE_LAYER_ID,
    text: "Variable weight 650",
    direction: "ltr",
    language: "en",
  });

  const missingDraft = structuredClone(base.snapshot);
  missingDraft.project.metadata.name = "Stage 11 Missing Asset Warning";
  const missingPage = missingDraft.project.guide.pages[SYNTHETIC_PAGE_ID];
  if (!missingPage) throw new Error("Stage 11 missing-asset fixture page is missing");
  missingPage.extras.push({
    id: MISSING_LAYER_ID,
    name: "Missing artwork",
    source: "extra",
    type: "image",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 80, y: 80, width: 320, height: 220, rotation: 0, scaleX: 1, scaleY: 1 },
    assetId: MISSING_ASSET_ID,
    fit: "contain",
  });
  const missing = projectSnapshotSchema.parse(missingDraft);

  const gradientBytes = new TextEncoder().encode(STAGE11_GRADIENT_SVG);
  const gradientHash = await hasher.hash(gradientBytes);
  const gradientDraft = structuredClone(base.snapshot);
  gradientDraft.project.metadata.name = "Stage 11 Complex SVG Gradient";
  gradientDraft.project.assetRefs.push({ assetId: GRADIENT_ASSET_ID });
  gradientDraft.assets.push({
    id: GRADIENT_ASSET_ID,
    projectId: SYNTHETIC_PROJECT_ID,
    contentHash: gradientHash,
    kind: "vector",
    name: "Stage 11 gradient artwork",
    originalFilename: "stage11-gradient.svg",
    mime: "image/svg+xml",
    extension: "svg",
    byteLength: gradientBytes.byteLength,
    createdAt: SYNTHETIC_TIMESTAMP,
    updatedAt: SYNTHETIC_TIMESTAMP,
    tags: ["stage-11", "golden"],
    metadata: { viewBox: "0 0 240 120" },
    binaryKey: gradientHash,
    security: { sanitized: true },
  });
  const gradientPage = gradientDraft.project.guide.pages[SYNTHETIC_PAGE_ID];
  if (!gradientPage) throw new Error("Stage 11 gradient fixture page is missing");
  gradientPage.extras.push({
    id: STAGE11_GRADIENT_LAYER_ID,
    name: "Gradient artwork",
    source: "extra",
    type: "vector",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 160, y: 180, width: 480, height: 240, rotation: 0, scaleX: 1, scaleY: 1 },
    data: { assetId: GRADIENT_ASSET_ID },
  });
  const gradient = projectSnapshotSchema.parse(gradientDraft);

  const legacy = migrateProjectSnapshot(JSON.parse(legacyV1Json) as unknown);

  return [
    {
      id: "latin-minimal",
      localeMode: "en",
      snapshot: latin,
      binaries: base.binaries,
      textLayerId: LATIN_LAYER_ID,
      expectedText: "Identity basics — ABC 123",
      expectedDirection: "ltr",
    },
    {
      id: "arabic-minimal",
      localeMode: "ar",
      snapshot: arabic,
      binaries: base.binaries,
      textLayerId: ARABIC_LAYER_ID,
      expectedText: "أساسيات الهوية — ١٢٣",
      expectedDirection: "rtl",
    },
    {
      id: "bilingual-standard",
      localeMode: "bilingual",
      snapshot: bilingual,
      binaries: base.binaries,
      textLayerId: BILINGUAL_LAYER_ID,
      expectedText: "Brand system — نظام الهوية — 2026 / ٢٠٢٦",
      expectedDirection: "auto",
    },
    {
      id: "variable-font-axis",
      localeMode: "en",
      snapshot: variable,
      binaries: base.binaries,
      textLayerId: VARIABLE_LAYER_ID,
      expectedText: "Variable weight 650",
      expectedDirection: "ltr",
    },
    {
      id: "missing-asset-warning",
      localeMode: "en",
      snapshot: missing,
      binaries: base.binaries,
    },
    {
      id: "complex-svg-gradient",
      localeMode: "en",
      snapshot: gradient,
      binaries: [
        ...base.binaries,
        { contentHash: gradientHash, mime: "image/svg+xml", bytes: gradientBytes },
      ],
      gradientAssetId: GRADIENT_ASSET_ID,
    },
    {
      id: "legacy-schema-migration",
      localeMode: "en",
      snapshot: legacy,
      binaries: base.binaries,
    },
  ];
}
