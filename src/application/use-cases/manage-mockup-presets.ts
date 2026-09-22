import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AssetId } from "@/domain/assets/asset";
import type { NormalizedRect } from "@/domain/common/primitives";
import {
  cloneDefaultMockupCrop,
  type MockupPreset,
  mockupPresetSchema,
  type MockupSurface,
} from "@/domain/mockup/mockup";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import { projectSnapshotSchema } from "@/domain/project/hawya-project";

export interface CreateMockupPresetInput {
  name: string;
  backgroundAssetId: AssetId;
  crop?: NormalizedRect;
  surface?: MockupSurface;
}

export interface UpdateMockupPresetInput {
  name: string;
  backgroundAssetId: AssetId;
  crop: NormalizedRect;
  surface?: MockupSurface;
}

export class ManageMockupPresetsUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async create(projectId: ProjectId, input: CreateMockupPresetInput): Promise<MockupPreset> {
    const snapshot = await this.requireProject(projectId);
    this.assertBackground(snapshot, input.backgroundAssetId);
    this.assertSurface(snapshot, input.surface);
    const now = this.clock.now();
    const preset = mockupPresetSchema.parse({
      id: this.ids.newId(),
      name: input.name,
      backgroundAssetId: input.backgroundAssetId,
      crop: input.crop ?? cloneDefaultMockupCrop(),
      ...(input.surface ? { surface: input.surface } : {}),
      createdAt: now,
      updatedAt: now,
    });
    await this.persist(snapshot, [...snapshot.project.mockups.presets, preset], now);
    return preset;
  }

  async update(
    projectId: ProjectId,
    presetId: string,
    input: UpdateMockupPresetInput,
  ): Promise<MockupPreset> {
    const snapshot = await this.requireProject(projectId);
    this.assertBackground(snapshot, input.backgroundAssetId);
    this.assertSurface(snapshot, input.surface);
    const existing = snapshot.project.mockups.presets.find((preset) => preset.id === presetId);
    if (!existing) throw new Error("Mockup preset does not exist");
    const now = this.clock.now();
    const { surface: _previousSurface, ...rest } = existing;
    const updated = mockupPresetSchema.parse({
      ...rest,
      ...input,
      ...(input.surface ? { surface: input.surface } : {}),
      updatedAt: now,
    });
    await this.persist(
      snapshot,
      snapshot.project.mockups.presets.map((preset) => (preset.id === presetId ? updated : preset)),
      now,
    );
    return updated;
  }

  async remove(projectId: ProjectId, presetId: string): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    if (!snapshot.project.mockups.presets.some((preset) => preset.id === presetId)) {
      return snapshot;
    }
    const now = this.clock.now();
    return this.persist(
      snapshot,
      snapshot.project.mockups.presets.filter((preset) => preset.id !== presetId),
      now,
    );
  }

  private async requireProject(projectId: ProjectId): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    return snapshot;
  }

  private assertSurface(snapshot: ProjectSnapshot, surface: MockupSurface | undefined): void {
    if (!surface) return;
    const artworkSource = surface.artwork;
    if (artworkSource.kind === "asset") {
      const artwork = snapshot.assets.find((asset) => asset.id === artworkSource.assetId);
      if (!artwork) throw new Error("Mockup artwork asset does not exist");
      if (!["logo", "image", "vector", "icon", "illustration"].includes(artwork.kind)) {
        throw new Error("Selected asset cannot be used as mockup artwork");
      }
      return;
    }
    if (!snapshot.project.guide.pages[artworkSource.pageId]) {
      throw new Error("Mockup artwork guide page does not exist");
    }
  }

  private assertBackground(snapshot: ProjectSnapshot, assetId: AssetId): void {
    const asset = snapshot.assets.find((candidate) => candidate.id === assetId);
    if (!asset) throw new Error("Mockup background asset does not exist");
    if (!((asset.kind === "mockup" || asset.kind === "image") && asset.mime !== "image/svg+xml")) {
      throw new Error("Mockup backgrounds must be raster image assets");
    }
  }

  private async persist(
    snapshot: ProjectSnapshot,
    presets: MockupPreset[],
    updatedAt: string,
  ): Promise<ProjectSnapshot> {
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt },
        mockups: { presets },
      },
    });
    await this.projects.save(next);
    return next;
  }
}
