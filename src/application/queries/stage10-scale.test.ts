import { describe, expect, it } from "vitest";

import type { ProjectRepository } from "@/application/ports/project-repository";
import { BrandSystemQuery } from "@/application/queries/brand-system-query";
import { GuideStudioQuery } from "@/application/queries/guide-studio-query";
import { editorAssetHydrationPlan } from "@/editor/model/editor-asset-hydration";
import { resolveRenderedScene } from "@/editor/scene/scene-resolver";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";

import {
  createStage10ScaleProject,
  STAGE10_SCALE_ASSETS,
  STAGE10_SCALE_FONTS,
  STAGE10_SCALE_LAYERS_PER_PAGE,
  STAGE10_SCALE_PAGES,
} from "../../../tests/fixtures/stage10/scale-project";

class ScaleProjectRepository implements ProjectRepository {
  constructor(private readonly snapshot: ProjectSnapshot) {}

  async save(): Promise<void> {}

  async get(projectId: ProjectId): Promise<ProjectSnapshot | undefined> {
    return projectId === this.snapshot.project.id ? this.snapshot : undefined;
  }

  async listMetadata() {
    return [{ id: this.snapshot.project.id, metadata: this.snapshot.project.metadata }];
  }

  async delete(): Promise<void> {}
}

describe("Stage 10 representative project scale", () => {
  it("keeps guide and brand projections bounded at the v1 scale target", async () => {
    const snapshot = await createStage10ScaleProject();
    expect(snapshot.project.guide.pageOrder).toHaveLength(STAGE10_SCALE_PAGES);
    expect(
      snapshot.project.guide.pageOrder.reduce(
        (total, pageId) => total + (snapshot.project.guide.pages[pageId]?.extras.length ?? 0),
        0,
      ),
    ).toBe(STAGE10_SCALE_PAGES * STAGE10_SCALE_LAYERS_PER_PAGE);
    expect(snapshot.assets).toHaveLength(STAGE10_SCALE_ASSETS);
    expect(snapshot.project.brand.typography.fonts).toHaveLength(STAGE10_SCALE_FONTS);

    const repository = new ScaleProjectRepository(snapshot);
    const startedAt = performance.now();
    const [guide, brand] = await Promise.all([
      new GuideStudioQuery(repository).execute(snapshot.project.id),
      new BrandSystemQuery(repository).execute(snapshot.project.id),
    ]);
    const elapsedMs = performance.now() - startedAt;

    expect(Object.keys(guide?.pageViews ?? {})).toHaveLength(STAGE10_SCALE_PAGES);
    expect(Object.keys(brand?.assetUsage ?? {})).toHaveLength(STAGE10_SCALE_ASSETS);
    expect(elapsedMs).toBeLessThan(500);

    const referencedScaleAsset = snapshot.assets.find(
      (asset) => asset.kind === "image" && asset.tags.includes("stage10-scale"),
    );
    expect(referencedScaleAsset).toBeDefined();
    if (!referencedScaleAsset || !brand) return;

    const layerUses = snapshot.project.guide.pageOrder.reduce((total, pageId) => {
      const page = snapshot.project.guide.pages[pageId];
      if (!page) return total;
      return (
        total +
        page.extras.filter(
          (layer) => layer.type === "image" && layer.assetId === referencedScaleAsset.id,
        ).length
      );
    }, 0);
    expect(brand.assetUsage[referencedScaleAsset.id]).toBe(layerUses);
  });

  it("hydrates only visual binaries referenced by the active editor scene", async () => {
    const snapshot = await createStage10ScaleProject();
    const pageId = snapshot.project.guide.pageOrder[0];
    const page = pageId ? snapshot.project.guide.pages[pageId] : undefined;
    expect(page).toBeDefined();
    if (!page) return;

    const scene = resolveRenderedScene(snapshot, page, "en");
    const expectedIds = new Set(
      scene.layers.flatMap((layer) => {
        if (layer.type === "image") return [layer.assetId];
        if (layer.type === "vector" && layer.assetId) return [layer.assetId];
        return [];
      }),
    );
    const plan = editorAssetHydrationPlan(snapshot.assets, scene.layers);

    expect(new Set(plan.map((entry) => entry.assetId))).toEqual(expectedIds);
    expect(plan.length).toBeLessThanOrEqual(STAGE10_SCALE_LAYERS_PER_PAGE);
    expect(plan.length).toBeLessThan(STAGE10_SCALE_ASSETS);
  });
});
