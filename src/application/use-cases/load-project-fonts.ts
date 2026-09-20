import type { BinaryStore } from "@/application/ports/binary-store";
import type { FontRegistry } from "@/application/ports/font-registry";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { ProjectId } from "@/domain/project/hawya-project";

export interface LoadProjectFontsResult {
  loaded: string[];
  failed: Array<{ fontRefId: string; reason: string }>;
}

export class LoadProjectFontsUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly binaries: BinaryStore,
    private readonly registry: FontRegistry,
  ) {}

  async execute(projectId: ProjectId): Promise<LoadProjectFontsResult> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    const loaded: string[] = [];
    const failed: Array<{ fontRefId: string; reason: string }> = [];
    for (const font of snapshot.project.brand.typography.fonts) {
      const asset = snapshot.assets.find((item) => item.id === font.assetId);
      if (!asset) {
        failed.push({ fontRefId: font.id, reason: "Font asset is missing" });
        continue;
      }
      const binary = await this.binaries.get(asset.contentHash);
      if (!binary) {
        failed.push({ fontRefId: font.id, reason: "Font binary is missing" });
        continue;
      }
      try {
        await this.registry.register(font, binary.bytes);
        loaded.push(font.id);
      } catch (error) {
        failed.push({
          fontRefId: font.id,
          reason: error instanceof Error ? error.message : "Font registration failed",
        });
      }
    }
    return { loaded, failed };
  }
}
