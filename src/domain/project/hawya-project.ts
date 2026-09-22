import * as z from "zod";

import { assetSchema, projectAssetRefSchema } from "@/domain/assets/asset";
import { brandSystemSchema } from "@/domain/brand/brand-system";
import {
  directionSchema,
  isoDateTimeSchema,
  localeSchema,
  uuidSchema,
} from "@/domain/common/primitives";
import { guideDocumentSchema } from "@/domain/guide/guide-document";
import { mockupCollectionSchema } from "@/domain/mockup/mockup";
import { templatePackRefSchema } from "@/domain/templates/template-ref";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/domain/project/schema-version";

export const projectIdSchema = uuidSchema;
export type ProjectId = z.infer<typeof projectIdSchema>;

export const projectMetadataSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  clientName: z.string().optional(),
  designerName: z.string().optional(),
  description: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastOpenedAt: isoDateTimeSchema.optional(),
  lastBackupAt: isoDateTimeSchema.optional(),
  lastExportAt: isoDateTimeSchema.optional(),
  thumbnailAssetId: uuidSchema.optional(),
  tags: z.array(z.string()),
});
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;

export const projectSettingsSchema = z.object({
  defaultContentLocale: localeSchema,
  enabledContentLocales: z.array(localeSchema).min(1),
  defaultDirection: directionSchema,
  guideProfile: z.enum(["minimal", "standard", "comprehensive", "custom"]),
  pagePreset: z.string().min(1),
  templateFamilyId: z.string().min(1),
  guideLocaleMode: z.enum(["en", "ar", "bilingual"]).optional(),
  unitDisplay: z.enum(["px", "mm", "in", "pt"]),
  snapEnabled: z.boolean(),
  autosaveEnabled: z.boolean(),
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export const revisionSummarySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  createdAt: isoDateTimeSchema,
  snapshotCreatedAt: isoDateTimeSchema,
});
export type RevisionSummary = z.infer<typeof revisionSummarySchema>;

export const hawyaProjectSchema = z.object({
  schemaVersion: z.literal(CURRENT_PROJECT_SCHEMA_VERSION),
  id: projectIdSchema,
  metadata: projectMetadataSchema,
  settings: projectSettingsSchema,
  brand: brandSystemSchema,
  guide: guideDocumentSchema,
  mockups: mockupCollectionSchema,
  assetRefs: z.array(projectAssetRefSchema),
  templatePackRefs: z.array(templatePackRefSchema),
  revisions: z.array(revisionSummarySchema),
});
export type HawyaProject = z.infer<typeof hawyaProjectSchema>;

export const projectSnapshotSchema = z
  .object({
    project: hawyaProjectSchema,
    assets: z.array(assetSchema),
  })
  .superRefine((snapshot, context) => {
    const assetIds = new Set(snapshot.assets.map((asset) => asset.id));
    const referencedAssetIds = snapshot.project.assetRefs.map((reference) => reference.assetId);

    if (assetIds.size !== snapshot.assets.length) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Asset IDs must be unique within a project snapshot",
      });
    }

    if (new Set(referencedAssetIds).size !== referencedAssetIds.length) {
      context.addIssue({
        code: "custom",
        path: ["project", "assetRefs"],
        message: "Project asset references must be unique",
      });
    }

    for (const asset of snapshot.assets) {
      if (asset.projectId !== snapshot.project.id) {
        context.addIssue({
          code: "custom",
          path: ["assets", asset.id, "projectId"],
          message: "Every asset must belong to the snapshot project",
        });
      }
    }

    for (const assetId of referencedAssetIds) {
      if (!assetIds.has(assetId)) {
        context.addIssue({
          code: "custom",
          path: ["project", "assetRefs"],
          message: `Project references missing asset ${assetId}`,
        });
      }
    }

    for (const preset of snapshot.project.mockups.presets) {
      const background = snapshot.assets.find((asset) => asset.id === preset.backgroundAssetId);
      if (!background) {
        context.addIssue({
          code: "custom",
          path: ["project", "mockups", "presets", preset.id, "backgroundAssetId"],
          message: `Mockup preset references missing background asset ${preset.backgroundAssetId}`,
        });
      } else if (
        !(
          (background.kind === "mockup" || background.kind === "image") &&
          background.mime !== "image/svg+xml"
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["project", "mockups", "presets", preset.id, "backgroundAssetId"],
          message: "Mockup preset background must be a raster mockup/image asset",
        });
      }

      const artwork = preset.surface?.artwork;
      if (artwork?.kind === "asset") {
        const artworkAsset = snapshot.assets.find((asset) => asset.id === artwork.assetId);
        if (!artworkAsset) {
          context.addIssue({
            code: "custom",
            path: ["project", "mockups", "presets", preset.id, "surface", "artwork"],
            message: `Mockup preset references missing artwork asset ${artwork.assetId}`,
          });
        }
      } else if (artwork?.kind === "page" && !snapshot.project.guide.pages[artwork.pageId]) {
        context.addIssue({
          code: "custom",
          path: ["project", "mockups", "presets", preset.id, "surface", "artwork"],
          message: `Mockup preset references missing guide page ${artwork.pageId}`,
        });
      }
    }

    if (
      snapshot.project.metadata.thumbnailAssetId &&
      !assetIds.has(snapshot.project.metadata.thumbnailAssetId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["project", "metadata", "thumbnailAssetId"],
        message: "Project thumbnail must reference an asset in the project",
      });
    }
  });
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;

export function rebaseProjectSnapshotId(
  snapshot: ProjectSnapshot,
  projectId: ProjectId,
): ProjectSnapshot {
  const rebased = {
    project: {
      ...snapshot.project,
      id: projectId,
    },
    assets: snapshot.assets.map((asset) => ({
      ...asset,
      projectId,
    })),
  };

  return projectSnapshotSchema.parse(rebased);
}
