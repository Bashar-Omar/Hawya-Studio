import type { ProjectRepository } from "@/application/ports/project-repository";
import type { GuidePage, PageId } from "@/domain/guide/guide-document";
import { StorageError } from "@/domain/project/errors";
import {
  type ProjectId,
  type ProjectMetadata,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";
import type {
  HawyaDatabase,
  PageRow,
  ProjectAssetRow,
  ProjectRow,
} from "@/infrastructure/db/hawya-database";

function asStorageError(message: string, cause: unknown): StorageError {
  return cause instanceof StorageError
    ? cause
    : new StorageError("transaction-failed", message, cause);
}

export class DexieProjectRepository implements ProjectRepository {
  constructor(private readonly db: HawyaDatabase) {}

  async save(input: ProjectSnapshot): Promise<void> {
    const snapshot = projectSnapshotSchema.parse(input);
    const { project, assets } = snapshot;

    const projectRow: ProjectRow = {
      id: project.id,
      schemaVersion: project.schemaVersion,
      name: project.metadata.name,
      updatedAt: project.metadata.updatedAt,
      metadata: project.metadata,
      settings: project.settings,
      guideSections: project.guide.sections,
      pageOrder: project.guide.pageOrder,
      assetRefs: project.assetRefs,
      templatePackRefs: project.templatePackRefs,
      revisions: project.revisions,
      ...(project.metadata.lastOpenedAt ? { lastOpenedAt: project.metadata.lastOpenedAt } : {}),
    };

    const pageRows: PageRow[] = project.guide.pageOrder.map((pageId, order) => ({
      projectId: project.id,
      id: pageId,
      order,
      page: project.guide.pages[pageId] as GuidePage,
    }));

    const assetRows: ProjectAssetRow[] = assets.map((asset) => ({
      projectId: project.id,
      id: asset.id,
      contentHash: asset.contentHash,
      kind: asset.kind,
      asset,
    }));

    try {
      await this.db.transaction(
        "rw",
        this.db.projects,
        this.db.brandSystems,
        this.db.pages,
        this.db.projectAssets,
        async () => {
          await this.db.projects.put(projectRow);
          await this.db.brandSystems.put({ projectId: project.id, brand: project.brand });
          await this.db.pages.where("projectId").equals(project.id).delete();
          await this.db.projectAssets.where("projectId").equals(project.id).delete();
          if (pageRows.length > 0) {
            await this.db.pages.bulkPut(pageRows);
          }
          if (assetRows.length > 0) {
            await this.db.projectAssets.bulkPut(assetRows);
          }
        },
      );
    } catch (error) {
      throw asStorageError(`Failed to persist project ${project.id}`, error);
    }
  }

  async get(projectId: ProjectId): Promise<ProjectSnapshot | undefined> {
    try {
      const [projectRow, brandRow, pageRows, assetRows] = await this.db.transaction(
        "r",
        this.db.projects,
        this.db.brandSystems,
        this.db.pages,
        this.db.projectAssets,
        async () =>
          Promise.all([
            this.db.projects.get(projectId),
            this.db.brandSystems.get(projectId),
            this.db.pages.where("projectId").equals(projectId).sortBy("order"),
            this.db.projectAssets.where("projectId").equals(projectId).toArray(),
          ]),
      );

      if (!projectRow) {
        return undefined;
      }
      if (!brandRow) {
        throw new StorageError(
          "corrupt-persisted-data",
          `Project ${projectId} has no persisted brand system`,
        );
      }

      const pages: Record<PageId, GuidePage> = {};
      for (const row of pageRows) {
        pages[row.id] = row.page;
      }

      const snapshot = {
        project: {
          schemaVersion: projectRow.schemaVersion,
          id: projectRow.id,
          metadata: projectRow.metadata,
          settings: projectRow.settings,
          brand: brandRow.brand,
          guide: {
            sections: projectRow.guideSections,
            pageOrder: projectRow.pageOrder,
            pages,
          },
          assetRefs: projectRow.assetRefs,
          templatePackRefs: projectRow.templatePackRefs,
          revisions: projectRow.revisions,
        },
        assets: assetRows.map((row) => row.asset),
      };

      const parsed = projectSnapshotSchema.safeParse(snapshot);
      if (!parsed.success) {
        throw new StorageError(
          "corrupt-persisted-data",
          `Project ${projectId} failed canonical validation after reload`,
          parsed.error,
        );
      }
      return parsed.data;
    } catch (error) {
      throw asStorageError(`Failed to load project ${projectId}`, error);
    }
  }

  async listMetadata(): Promise<ProjectMetadata[]> {
    try {
      const rows = await this.db.projects.orderBy("updatedAt").reverse().toArray();
      return rows.map((row) => row.metadata);
    } catch (error) {
      throw asStorageError("Failed to list project metadata", error);
    }
  }

  async delete(projectId: ProjectId): Promise<void> {
    try {
      await this.db.transaction(
        "rw",
        this.db.projects,
        this.db.brandSystems,
        this.db.pages,
        this.db.projectAssets,
        this.db.snapshots,
        async () => {
          await this.db.projects.delete(projectId);
          await this.db.brandSystems.delete(projectId);
          await this.db.pages.where("projectId").equals(projectId).delete();
          await this.db.projectAssets.where("projectId").equals(projectId).delete();
          await this.db.snapshots.where("projectId").equals(projectId).delete();
        },
      );
    } catch (error) {
      throw asStorageError(`Failed to delete project ${projectId}`, error);
    }
  }
}
