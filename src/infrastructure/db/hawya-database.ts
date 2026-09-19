import Dexie, { type Table } from "dexie";

import type { Asset, AssetKind, ContentHash } from "@/domain/assets/asset";
import type { BrandSystem } from "@/domain/brand/brand-system";
import type { GuidePage, GuideSection, PageId } from "@/domain/guide/guide-document";
import type {
  ProjectId,
  ProjectMetadata,
  ProjectSettings,
  RevisionSummary,
} from "@/domain/project/hawya-project";
import type { StoredProjectSnapshot } from "@/domain/project/snapshot";
import type { ProjectAssetRef } from "@/domain/assets/asset";
import type { TemplatePackRef } from "@/domain/templates/template-ref";

export const HAWYA_DATABASE_NAME = "hawya-studio";
export const HAWYA_DATABASE_VERSION = 1;

export interface ProjectRow {
  id: ProjectId;
  schemaVersion: number;
  name: string;
  updatedAt: string;
  lastOpenedAt?: string;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  guideSections: GuideSection[];
  pageOrder: PageId[];
  assetRefs: ProjectAssetRef[];
  templatePackRefs: TemplatePackRef[];
  revisions: RevisionSummary[];
}

export interface BrandSystemRow {
  projectId: ProjectId;
  brand: BrandSystem;
}

export interface PageRow {
  projectId: ProjectId;
  id: PageId;
  order: number;
  page: GuidePage;
}

export interface ProjectAssetRow {
  projectId: ProjectId;
  id: string;
  contentHash: ContentHash;
  kind: AssetKind;
  asset: Asset;
}

export interface BinaryRow {
  contentHash: ContentHash;
  blob: Blob;
  byteLength: number;
  mime: string;
  createdAt: string;
}

export interface SnapshotRow {
  projectId: ProjectId;
  createdAt: string;
  named: boolean;
  kind: StoredProjectSnapshot["kind"];
  snapshot: StoredProjectSnapshot;
}

export interface PreferenceRow {
  key: string;
  value: unknown;
}

export class HawyaDatabase extends Dexie {
  projects!: Table<ProjectRow, ProjectId>;
  brandSystems!: Table<BrandSystemRow, ProjectId>;
  pages!: Table<PageRow, [ProjectId, PageId]>;
  projectAssets!: Table<ProjectAssetRow, [ProjectId, string]>;
  binaries!: Table<BinaryRow, ContentHash>;
  snapshots!: Table<SnapshotRow, [ProjectId, string]>;
  preferences!: Table<PreferenceRow, string>;

  constructor(name = HAWYA_DATABASE_NAME) {
    super(name);

    this.version(HAWYA_DATABASE_VERSION).stores({
      projects: "id, name, updatedAt, lastOpenedAt",
      brandSystems: "projectId",
      pages: "[projectId+id], projectId, [projectId+order]",
      projectAssets: "[projectId+id], projectId, contentHash, kind",
      binaries: "contentHash",
      snapshots: "[projectId+createdAt], projectId, named, kind",
      preferences: "key",
    });
  }
}
