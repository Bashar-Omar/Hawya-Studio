import type { BinaryPayload } from "@/application/ports/binary-store";
import type { ContentHasher } from "@/application/ports/content-hasher";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/domain/project/schema-version";
import { type ProjectSnapshot, projectSnapshotSchema } from "@/domain/project/hawya-project";

export const SYNTHETIC_PROJECT_ID = "00000000-0000-4000-8000-000000000001";
export const SYNTHETIC_IMPORT_ID = "00000000-0000-4000-8000-000000000099";
export const SYNTHETIC_PAGE_ID = "00000000-0000-4000-8000-000000000010";
export const SYNTHETIC_SECTION_ID = "00000000-0000-4000-8000-000000000011";
export const SYNTHETIC_LOGO_ASSET_ID = "00000000-0000-4000-8000-000000000020";
export const SYNTHETIC_DUPLICATE_ASSET_ID = "00000000-0000-4000-8000-000000000021";
export const SYNTHETIC_FONT_ASSET_ID = "00000000-0000-4000-8000-000000000022";
export const SYNTHETIC_LOGO_VARIANT_ID = "00000000-0000-4000-8000-000000000030";
export const SYNTHETIC_FONT_REF_ID = "00000000-0000-4000-8000-000000000031";
export const SYNTHETIC_TEXT_STYLE_ID = "00000000-0000-4000-8000-000000000032";
export const SYNTHETIC_COLOR_ID = "00000000-0000-4000-8000-000000000033";

export const SYNTHETIC_TIMESTAMP = "2026-09-19T10:00:00.000Z";
export const SYNTHETIC_SAVE_TIMESTAMP = "2026-09-19T10:01:00.000Z";

export const sharedImageBytes = new TextEncoder().encode("hawya-stage02-shared-image-bytes");
export const fontBytes = new TextEncoder().encode("hawya-stage02-font-bytes");

export interface SyntheticProjectFixture {
  snapshot: ProjectSnapshot;
  binaries: BinaryPayload[];
}

export async function createSyntheticProjectFixture(
  hasher: ContentHasher,
): Promise<SyntheticProjectFixture> {
  const imageHash = await hasher.hash(sharedImageBytes);
  const fontHash = await hasher.hash(fontBytes);

  const snapshot = projectSnapshotSchema.parse({
    project: {
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      id: SYNTHETIC_PROJECT_ID,
      metadata: {
        name: "Synthetic Identity",
        slug: "synthetic-identity",
        clientName: "Fixture Client",
        createdAt: SYNTHETIC_TIMESTAMP,
        updatedAt: SYNTHETIC_TIMESTAMP,
        tags: ["fixture", "stage-02"],
        thumbnailAssetId: SYNTHETIC_LOGO_ASSET_ID,
      },
      settings: {
        defaultContentLocale: "en",
        enabledContentLocales: ["en", "ar"],
        defaultDirection: "ltr",
        guideProfile: "standard",
        pagePreset: "screen-16-9",
        templateFamilyId: "essential",
        unitDisplay: "px",
        snapEnabled: true,
        autosaveEnabled: true,
      },
      brand: {
        identity: {
          brandName: { en: "Synthetic Identity", ar: "هوية تجريبية" },
          values: [],
          personality: [],
        },
        logos: {
          variants: [
            {
              id: SYNTHETIC_LOGO_VARIANT_ID,
              name: { en: "Primary", ar: "الأساسي" },
              role: "primary",
              assetId: SYNTHETIC_LOGO_ASSET_ID,
            },
          ],
          primaryLogoId: SYNTHETIC_LOGO_VARIANT_ID,
          rules: { incorrectUsage: [] },
        },
        colors: {
          tokens: [
            {
              id: SYNTHETIC_COLOR_ID,
              name: { en: "Ink", ar: "حبر" },
              role: "primary",
              srgbHex: "#111111",
              alpha: 1,
              rgb: { r: 17, g: 17, b: 17 },
            },
          ],
        },
        typography: {
          fonts: [
            {
              id: SYNTHETIC_FONT_REF_ID,
              assetId: SYNTHETIC_FONT_ASSET_ID,
              familyName: "Synthetic Sans",
              weight: 400,
              style: "normal",
            },
          ],
          styles: [
            {
              id: SYNTHETIC_TEXT_STYLE_ID,
              name: "Body",
              role: "body",
              fontRefId: SYNTHETIC_FONT_REF_ID,
              fontSize: 16,
              lineHeight: 24,
              letterSpacing: 0,
              fontWeight: 400,
              direction: "auto",
              colorTokenId: SYNTHETIC_COLOR_ID,
            },
          ],
        },
        visualLanguage: {},
      },
      guide: {
        sections: [
          {
            id: SYNTHETIC_SECTION_ID,
            type: "overview",
            title: { en: "Overview", ar: "نظرة عامة" },
            pageIds: [SYNTHETIC_PAGE_ID],
          },
        ],
        pageOrder: [SYNTHETIC_PAGE_ID],
        pages: {
          [SYNTHETIC_PAGE_ID]: {
            id: SYNTHETIC_PAGE_ID,
            name: { en: "Cover", ar: "الغلاف" },
            semanticType: "cover",
            content: { title: "Synthetic Identity" },
            templateBinding: {
              templateId: "essential.cover",
              version: 1,
              slotBindings: { title: "page.content.title" },
            },
            canvas: {
              width: 1200,
              height: 675,
              unit: "px",
              background: { type: "solid", color: "#FFFFFF", alpha: 1 },
            },
            extras: [],
            localOverrides: [],
          },
        },
      },
      mockups: { presets: [] },
      assetRefs: [
        { assetId: SYNTHETIC_LOGO_ASSET_ID },
        { assetId: SYNTHETIC_DUPLICATE_ASSET_ID },
        { assetId: SYNTHETIC_FONT_ASSET_ID },
      ],
      templatePackRefs: [{ id: "builtin-core", version: 1 }],
      revisions: [],
    },
    assets: [
      {
        id: SYNTHETIC_LOGO_ASSET_ID,
        projectId: SYNTHETIC_PROJECT_ID,
        contentHash: imageHash,
        kind: "logo",
        name: "Primary logo",
        originalFilename: "logo.svg",
        mime: "image/svg+xml",
        extension: "svg",
        byteLength: sharedImageBytes.byteLength,
        createdAt: SYNTHETIC_TIMESTAMP,
        updatedAt: SYNTHETIC_TIMESTAMP,
        tags: ["logo"],
        metadata: {},
        binaryKey: imageHash,
        security: { sanitized: true },
      },
      {
        id: SYNTHETIC_DUPLICATE_ASSET_ID,
        projectId: SYNTHETIC_PROJECT_ID,
        contentHash: imageHash,
        kind: "image",
        name: "Shared binary duplicate",
        originalFilename: "duplicate.svg",
        mime: "image/svg+xml",
        extension: "svg",
        byteLength: sharedImageBytes.byteLength,
        createdAt: SYNTHETIC_TIMESTAMP,
        updatedAt: SYNTHETIC_TIMESTAMP,
        tags: ["dedup"],
        metadata: {},
        binaryKey: imageHash,
        security: { sanitized: true },
      },
      {
        id: SYNTHETIC_FONT_ASSET_ID,
        projectId: SYNTHETIC_PROJECT_ID,
        contentHash: fontHash,
        kind: "font",
        name: "Synthetic Sans Regular",
        originalFilename: "synthetic-sans.woff2",
        mime: "font/woff2",
        extension: "woff2",
        byteLength: fontBytes.byteLength,
        createdAt: SYNTHETIC_TIMESTAMP,
        updatedAt: SYNTHETIC_TIMESTAMP,
        tags: ["font"],
        metadata: { family: "Synthetic Sans" },
        binaryKey: fontHash,
        security: {},
      },
    ],
  });

  return {
    snapshot,
    binaries: [
      { contentHash: imageHash, mime: "image/svg+xml", bytes: sharedImageBytes },
      { contentHash: fontHash, mime: "font/woff2", bytes: fontBytes },
    ],
  };
}
