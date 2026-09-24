import type { ContentHasher } from "@/application/ports/content-hasher";
import { projectSnapshotSchema } from "@/domain/project/hawya-project";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_SECTION_ID,
} from "../stage02/synthetic-project";

const PAGE_COUNT = 50;
const LAYERS_PER_PAGE = 10;
const ASSET_COUNT = 100;

function fixtureUuid(sequence: number): string {
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`;
}

export async function createStage10ScaleProjectFixture(hasher: ContentHasher) {
  const base = await createSyntheticProjectFixture(hasher);
  const basePage = Object.values(base.snapshot.project.guide.pages)[0];
  const sharedImage = base.snapshot.assets.find((asset) => asset.kind === "logo");

  if (!basePage || !sharedImage) {
    throw new Error("Stage 10 scale fixture requires the Stage 02 base page and shared image.");
  }

  const pageIds = Array.from({ length: PAGE_COUNT }, (_, index) => fixtureUuid(1_000 + index));
  const pages = Object.fromEntries(
    pageIds.map((pageId, pageIndex) => [
      pageId,
      {
        ...basePage,
        id: pageId,
        name: {
          en: `Scale page ${pageIndex + 1}`,
          ar: `صفحة قياس ${pageIndex + 1}`,
        },
        extras: Array.from({ length: LAYERS_PER_PAGE }, (_, layerIndex) => ({
          id: fixtureUuid(100_000 + pageIndex * LAYERS_PER_PAGE + layerIndex),
          name: `Scale layer ${pageIndex + 1}.${layerIndex + 1}`,
          visible: true,
          locked: false,
          opacity: 1,
          transform: {
            x: 24 + layerIndex * 18,
            y: 24 + layerIndex * 12,
            width: 120,
            height: 72,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          source: "extra" as const,
          type: "shape" as const,
          data: {
            shape: "rect",
            fill: layerIndex % 2 === 0 ? "#111111" : "#F2F2F2",
          },
        })),
        localOverrides: [],
      },
    ]),
  );

  const extraAssetCount = ASSET_COUNT - base.snapshot.assets.length;
  const extraAssets = Array.from({ length: extraAssetCount }, (_, index) => ({
    ...sharedImage,
    id: fixtureUuid(200_000 + index),
    kind: "image" as const,
    name: `Scale asset ${index + 1}`,
    originalFilename: `scale-asset-${index + 1}.svg`,
    tags: ["stage-10", "scale"],
  }));
  const assets = [...base.snapshot.assets, ...extraAssets];

  const snapshot = projectSnapshotSchema.parse({
    ...base.snapshot,
    project: {
      ...base.snapshot.project,
      metadata: {
        ...base.snapshot.project.metadata,
        name: "Stage 10 Scale Identity",
        slug: "stage-10-scale-identity",
      },
      guide: {
        sections: [
          {
            id: SYNTHETIC_SECTION_ID,
            type: "overview",
            title: { en: "Scale pages", ar: "صفحات القياس" },
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

  return {
    snapshot,
    binaries: base.binaries,
    expected: {
      pages: PAGE_COUNT,
      layers: PAGE_COUNT * LAYERS_PER_PAGE,
      assets: ASSET_COUNT,
    },
  };
}
