import type { Asset } from "@/domain/assets/asset";
import type { Layer } from "@/domain/guide/guide-document";
import {
  projectSnapshotSchema,
  type ProjectSnapshot,
} from "@/domain/project/hawya-project";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";

import { createSyntheticProjectFixture } from "../stage02/synthetic-project";

export const STAGE10_SCALE_PAGES = 50;
export const STAGE10_SCALE_LAYERS_PER_PAGE = 10;
export const STAGE10_SCALE_ASSETS = 100;
export const STAGE10_SCALE_FONTS = 4;

function scaleUuid(namespace: number, index: number): string {
  const suffix = String(index).padStart(12, "0");
  return `${String(namespace).padStart(8, "0")}-0000-4000-8000-${suffix}`;
}

function scaleHash(index: number): string {
  return index.toString(16).padStart(64, "0");
}

export async function createStage10ScaleProject(): Promise<ProjectSnapshot> {
  const base = (await createSyntheticProjectFixture(new WebCryptoSha256Hasher())).snapshot;
  const basePageId = base.project.guide.pageOrder[0];
  const basePage = basePageId ? base.project.guide.pages[basePageId] : undefined;
  const baseSection = base.project.guide.sections[0];
  if (!basePage || !baseSection) {
    throw new Error("Stage 10 scale fixture requires the Stage 02 synthetic guide page.");
  }

  const extraAssetCount = STAGE10_SCALE_ASSETS - base.assets.length;
  const extraAssets: Asset[] = Array.from({ length: extraAssetCount }, (_, index) => {
    const sequence = index + 1;
    const font = index < STAGE10_SCALE_FONTS - base.project.brand.typography.fonts.length;
    const contentHash = scaleHash(sequence);
    return {
      id: scaleUuid(3, sequence),
      projectId: base.project.id,
      contentHash,
      kind: font ? "font" : "image",
      name: font ? `Scale Sans ${sequence}` : `Scale asset ${sequence}`,
      originalFilename: font ? `scale-${sequence}.woff2` : `scale-${sequence}.png`,
      mime: font ? "font/woff2" : "image/png",
      extension: font ? "woff2" : "png",
      byteLength: 1024 + sequence,
      createdAt: base.project.metadata.createdAt,
      updatedAt: base.project.metadata.updatedAt,
      tags: ["stage10-scale"],
      metadata: font
        ? { family: `Scale Sans ${sequence}` }
        : { width: 1600, height: 1200 },
      binaryKey: contentHash,
      security: {},
    };
  });
  const assets = [...base.assets, ...extraAssets];
  const imageAssets = assets.filter((asset) => asset.kind !== "font");
  const pageIds = Array.from({ length: STAGE10_SCALE_PAGES }, (_, index) =>
    scaleUuid(2, index + 1),
  );

  const pages = Object.fromEntries(
    pageIds.map((pageId, pageIndex) => {
      const extras: Layer[] = Array.from({ length: STAGE10_SCALE_LAYERS_PER_PAGE }, (_, layerIndex) => {
        const common = {
          id: scaleUuid(4, pageIndex * STAGE10_SCALE_LAYERS_PER_PAGE + layerIndex + 1),
          name: `Scale layer ${pageIndex + 1}.${layerIndex + 1}`,
          visible: true,
          locked: false,
          opacity: 1,
          transform: {
            x: 24 + layerIndex * 12,
            y: 24 + layerIndex * 10,
            width: 160,
            height: 90,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          source: "extra" as const,
        };
        if (layerIndex % 2 === 0) {
          const asset = imageAssets[(pageIndex * 5 + layerIndex / 2) % imageAssets.length];
          if (!asset) throw new Error("Stage 10 scale fixture requires image assets.");
          return {
            ...common,
            type: "image" as const,
            assetId: asset.id,
            fit: "contain" as const,
          };
        }
        return {
          ...common,
          type: "shape" as const,
          data: { shape: "rect", fill: "#111111" },
        };
      });
      return [
        pageId,
        {
          ...basePage,
          id: pageId,
          name: { en: `Scale page ${pageIndex + 1}`, ar: `صفحة قياس ${pageIndex + 1}` },
          extras,
          localOverrides: [],
        },
      ];
    }),
  );

  const fontAssets = extraAssets.filter((asset) => asset.kind === "font");
  const extraFonts = fontAssets.map((asset, index) => ({
    id: scaleUuid(5, index + 1),
    assetId: asset.id,
    familyName: `Scale Sans ${index + 1}`,
    weight: 400,
    style: "normal" as const,
  }));

  return projectSnapshotSchema.parse({
    ...base,
    project: {
      ...base.project,
      brand: {
        ...base.project.brand,
        typography: {
          ...base.project.brand.typography,
          fonts: [...base.project.brand.typography.fonts, ...extraFonts],
        },
      },
      guide: {
        sections: [
          {
            ...baseSection,
            id: scaleUuid(6, 1),
            title: { en: "Scale validation", ar: "اختبار القياس" },
            pageIds,
          },
        ],
        pageOrder: pageIds,
        pages,
      },
      assetRefs: assets.map((asset) => ({ assetId: asset.id })),
    },
    assets,
  });
}
