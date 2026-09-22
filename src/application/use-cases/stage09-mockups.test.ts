import { describe, expect, it } from "vitest";

import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectListItem, ProjectRepository } from "@/application/ports/project-repository";
import { ManageMockupPresetsUseCase } from "@/application/use-cases/manage-mockup-presets";
import { countAssetReferences } from "@/domain/brand/brand-references";
import { cloneDefaultMockupQuad } from "@/domain/mockup/mockup";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_DUPLICATE_ASSET_ID,
  SYNTHETIC_LOGO_ASSET_ID,
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_PROJECT_ID,
} from "../../../tests/fixtures/stage02/synthetic-project";

const MOCKUP_ASSET_ID = "00000000-0000-4000-8000-000000000901";
const MOCKUP_PRESET_ID = "00000000-0000-4000-8000-000000000902";
const MOCKUP_CONTENT_HASH = "9999999999999999999999999999999999999999999999999999999999999999";

class TestClock implements Clock {
  now() {
    return "2026-09-22T12:00:00.000Z";
  }
}

class FixedIds implements IdGenerator {
  newId() {
    return MOCKUP_PRESET_ID;
  }
}

class MemoryProjects implements ProjectRepository {
  constructor(private snapshot: ProjectSnapshot) {}

  async save(snapshot: ProjectSnapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot);
  }

  async get(projectId: ProjectId): Promise<ProjectSnapshot | undefined> {
    return projectId === this.snapshot.project.id ? structuredClone(this.snapshot) : undefined;
  }

  async listMetadata(): Promise<ProjectListItem[]> {
    return [{ id: this.snapshot.project.id, metadata: this.snapshot.project.metadata }];
  }

  async delete(): Promise<void> {}
}

async function projectsWithRasterBackground(): Promise<MemoryProjects> {
  const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
  const snapshot = structuredClone(fixture.snapshot);
  const source = snapshot.assets.find((asset) => asset.id === SYNTHETIC_DUPLICATE_ASSET_ID);
  if (!source) throw new Error("Synthetic source asset is missing");
  snapshot.assets.push({
    ...source,
    id: MOCKUP_ASSET_ID,
    contentHash: MOCKUP_CONTENT_HASH as typeof source.contentHash,
    binaryKey: MOCKUP_CONTENT_HASH as typeof source.binaryKey,
    kind: "mockup",
    name: "Desk mockup",
    originalFilename: "desk.webp",
    mime: "image/webp",
    extension: "webp",
    metadata: { width: 1200, height: 800 },
    security: {},
  });
  snapshot.project.assetRefs.push({ assetId: MOCKUP_ASSET_ID });
  return new MemoryProjects(snapshot);
}

function useCase(projects: ProjectRepository) {
  return new ManageMockupPresetsUseCase(projects, new TestClock(), new FixedIds());
}

describe("Stage 09 mockup preset application boundary", () => {
  it("persists reusable presets and their asset references", async () => {
    const projects = await projectsWithRasterBackground();
    const mockups = useCase(projects);

    const created = await mockups.create(SYNTHETIC_PROJECT_ID, {
      name: "Stationery",
      backgroundAssetId: MOCKUP_ASSET_ID,
      surface: {
        corners: cloneDefaultMockupQuad(),
        artwork: { kind: "asset", assetId: SYNTHETIC_LOGO_ASSET_ID },
        opacity: 0.9,
        blendMode: "multiply",
        shadowStrength: 0.2,
        highlightStrength: 0.1,
      },
    });

    expect(created.id).toBe(MOCKUP_PRESET_ID);
    const stored = await projects.get(SYNTHETIC_PROJECT_ID);
    expect(stored?.project.mockups.presets).toHaveLength(1);
    expect(stored ? countAssetReferences(stored, MOCKUP_ASSET_ID) : 0).toBe(2);
    expect(stored ? countAssetReferences(stored, SYNTHETIC_LOGO_ASSET_ID) : 0).toBeGreaterThan(1);

    await mockups.update(SYNTHETIC_PROJECT_ID, MOCKUP_PRESET_ID, {
      name: "Stationery revised",
      backgroundAssetId: MOCKUP_ASSET_ID,
      crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      surface: {
        corners: cloneDefaultMockupQuad(),
        artwork: { kind: "page", pageId: SYNTHETIC_PAGE_ID },
        opacity: 1,
        blendMode: "normal",
        shadowStrength: 0,
        highlightStrength: 0,
      },
    });
    expect((await projects.get(SYNTHETIC_PROJECT_ID))?.project.mockups.presets[0]?.name).toBe(
      "Stationery revised",
    );

    await mockups.remove(SYNTHETIC_PROJECT_ID, MOCKUP_PRESET_ID);
    expect((await projects.get(SYNTHETIC_PROJECT_ID))?.project.mockups.presets).toEqual([]);
  });

  it("rejects vector backgrounds and unresolved artwork references", async () => {
    const projects = await projectsWithRasterBackground();
    const mockups = useCase(projects);

    await expect(
      mockups.create(SYNTHETIC_PROJECT_ID, {
        name: "Invalid SVG background",
        backgroundAssetId: SYNTHETIC_DUPLICATE_ASSET_ID,
      }),
    ).rejects.toThrow("raster image");

    await expect(
      mockups.create(SYNTHETIC_PROJECT_ID, {
        name: "Missing artwork",
        backgroundAssetId: MOCKUP_ASSET_ID,
        surface: {
          corners: cloneDefaultMockupQuad(),
          artwork: { kind: "asset", assetId: "00000000-0000-4000-8000-000000000999" },
          opacity: 1,
          blendMode: "normal",
          shadowStrength: 0,
          highlightStrength: 0,
        },
      }),
    ).rejects.toThrow("artwork asset does not exist");
  });
});
