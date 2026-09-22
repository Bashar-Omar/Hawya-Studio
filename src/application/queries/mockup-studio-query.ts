import type { ProjectRepository } from "@/application/ports/project-repository";
import type { Asset } from "@/domain/assets/asset";
import type { PageId } from "@/domain/guide/guide-document";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";

export interface MockupStudioView {
  snapshot: ProjectSnapshot;
  backgrounds: Asset[];
  artworkAssets: Asset[];
  pageIds: PageId[];
}

const ARTWORK_KINDS = new Set(["logo", "image", "vector", "icon", "illustration"]);

export class MockupStudioQuery {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(projectId: ProjectId): Promise<MockupStudioView | undefined> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) return undefined;
    return {
      snapshot,
      backgrounds: snapshot.assets.filter(
        (asset) =>
          (asset.kind === "mockup" || asset.kind === "image") &&
          asset.mime !== "image/svg+xml",
      ),
      artworkAssets: snapshot.assets.filter((asset) => ARTWORK_KINDS.has(asset.kind)),
      pageIds: [...snapshot.project.guide.pageOrder],
    };
  }
}
