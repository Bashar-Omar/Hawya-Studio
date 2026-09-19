import * as z from "zod";

import {
  directionSchema,
  localizedStringSchema,
  normalizedRectSchema,
  paintSchema,
  uuidSchema,
} from "@/domain/common/primitives";
import { assetIdSchema } from "@/domain/assets/asset";

export const pageIdSchema = uuidSchema;
export type PageId = z.infer<typeof pageIdSchema>;

export const contentBindingSchema = z.string().min(1).max(512);
export type ContentBinding = z.infer<typeof contentBindingSchema>;

const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  rotation: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
});

const layerBaseShape = {
  id: uuidSchema,
  name: z.string().min(1),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  blendMode: z.string().optional(),
  transform: transformSchema,
  parentGroupId: uuidSchema.optional(),
  source: z.enum(["template", "extra"]),
};

const textLayerSchema = z.object({
  ...layerBaseShape,
  type: z.literal("text"),
  content: z.union([z.string(), z.object({ binding: contentBindingSchema })]),
  typography: z.union([
    z.record(z.string(), z.unknown()),
    z.object({
      tokenId: uuidSchema,
      overrides: z.record(z.string(), z.unknown()).optional(),
    }),
  ]),
  fill: z.union([paintSchema, z.object({ colorTokenId: uuidSchema })]),
  alignment: z.enum(["start", "center", "end", "justify"]),
  verticalAlign: z.enum(["top", "middle", "bottom"]),
  direction: z.union([z.literal("auto"), directionSchema]),
  language: z.string().optional(),
  overflow: z.enum(["clip", "ellipsis", "visible"]),
});

const imageLayerSchema = z.object({
  ...layerBaseShape,
  type: z.literal("image"),
  assetId: assetIdSchema,
  fit: z.enum(["cover", "contain", "fill"]),
  crop: normalizedRectSchema.optional(),
  cornerRadius: z.number().nonnegative().optional(),
});

const flexibleLayerSchema = z.object({
  ...layerBaseShape,
  type: z.enum(["vector", "shape", "group"]),
  data: z.record(z.string(), z.unknown()),
});

export const layerSchema = z.union([textLayerSchema, imageLayerSchema, flexibleLayerSchema]);
export type Layer = z.infer<typeof layerSchema>;

export const guidePageSchema = z.object({
  id: pageIdSchema,
  name: localizedStringSchema,
  semanticType: z.string().min(1),
  content: z.record(z.string(), z.unknown()),
  templateBinding: z.object({
    templateId: z.string().min(1),
    version: z.number().int().positive(),
    slotBindings: z.record(z.string(), contentBindingSchema),
  }),
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(["px", "mm", "in", "pt"]),
    background: paintSchema,
    bleed: z
      .object({
        top: z.number().nonnegative(),
        right: z.number().nonnegative(),
        bottom: z.number().nonnegative(),
        left: z.number().nonnegative(),
      })
      .optional(),
  }),
  extras: z.array(layerSchema),
  localOverrides: z.array(z.record(z.string(), z.unknown())),
});
export type GuidePage = z.infer<typeof guidePageSchema>;

export const guideSectionSchema = z.object({
  id: uuidSchema,
  type: z.string().min(1),
  title: localizedStringSchema,
  pageIds: z.array(pageIdSchema),
  collapsedInEditor: z.boolean().optional(),
});
export type GuideSection = z.infer<typeof guideSectionSchema>;

export const guideDocumentSchema = z
  .object({
    sections: z.array(guideSectionSchema),
    pageOrder: z.array(pageIdSchema),
    pages: z.record(pageIdSchema, guidePageSchema),
  })
  .superRefine((guide, context) => {
    const pageIds = new Set(Object.keys(guide.pages));
    if (pageIds.size !== guide.pageOrder.length) {
      context.addIssue({
        code: "custom",
        path: ["pageOrder"],
        message: "pageOrder must contain every page exactly once",
      });
      return;
    }

    const orderedIds = new Set(guide.pageOrder);
    if (
      orderedIds.size !== guide.pageOrder.length ||
      [...pageIds].some((id) => !orderedIds.has(id))
    ) {
      context.addIssue({
        code: "custom",
        path: ["pageOrder"],
        message: "pageOrder contains missing or duplicate page IDs",
      });
    }

    for (const section of guide.sections) {
      for (const pageId of section.pageIds) {
        if (!pageIds.has(pageId)) {
          context.addIssue({
            code: "custom",
            path: ["sections", section.id, "pageIds"],
            message: `Section references unknown page ${pageId}`,
          });
        }
      }
    }
  });
export type GuideDocument = z.infer<typeof guideDocumentSchema>;
