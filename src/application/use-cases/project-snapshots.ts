import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { SnapshotRepository } from "@/application/ports/snapshot-repository";
import { type ProjectSnapshot, projectSnapshotSchema } from "@/domain/project/hawya-project";
import {
  DEFAULT_SNAPSHOT_RETENTION_POLICY,
  type SnapshotKind,
  type StoredProjectSnapshot,
  storedProjectSnapshotSchema,
} from "@/domain/project/snapshot";

export interface SnapshotRetentionPolicy {
  autosave: number;
  recovery: number;
}

export class ProjectSnapshotService {
  constructor(
    private readonly snapshots: SnapshotRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly retention: SnapshotRetentionPolicy = DEFAULT_SNAPSHOT_RETENTION_POLICY,
  ) {}

  async createNamedSnapshot(input: ProjectSnapshot, name: string): Promise<ProjectSnapshot> {
    const snapshot = projectSnapshotSchema.parse(input);
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Named snapshots require a non-empty name");
    }

    const createdAt = this.clock.now();
    const revisionId = this.ids.newId();
    const record = this.buildSnapshot(snapshot, {
      kind: "named",
      createdAt,
      name: trimmedName,
      revisionId,
    });
    await this.snapshots.put(record);

    const updated = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        revisions: [
          ...snapshot.project.revisions,
          {
            id: revisionId,
            name: trimmedName,
            createdAt,
            snapshotCreatedAt: createdAt,
          },
        ],
      },
    });
    await this.projects.save(updated);
    return updated;
  }

  async createRecoverySnapshot(
    input: ProjectSnapshot,
    reason: string,
  ): Promise<StoredProjectSnapshot> {
    const snapshot = projectSnapshotSchema.parse(input);
    const record = this.buildSnapshot(snapshot, {
      kind: "recovery",
      createdAt: this.clock.now(),
      reason: reason.trim() || "Recovery checkpoint",
    });
    await this.snapshots.put(record);
    await this.prune(snapshot.project.id, "recovery", this.retention.recovery);
    return record;
  }

  async createAutosaveCheckpoint(input: ProjectSnapshot): Promise<StoredProjectSnapshot> {
    const snapshot = projectSnapshotSchema.parse(input);
    const record = this.buildSnapshot(snapshot, {
      kind: "autosave",
      createdAt: this.clock.now(),
    });
    await this.snapshots.put(record);
    await this.prune(snapshot.project.id, "autosave", this.retention.autosave);
    return record;
  }

  private buildSnapshot(
    snapshot: ProjectSnapshot,
    metadata: {
      kind: SnapshotKind;
      createdAt: string;
      name?: string;
      reason?: string;
      revisionId?: string;
    },
  ): StoredProjectSnapshot {
    const binaryHashes = [...new Set(snapshot.assets.map((asset) => asset.contentHash))].sort();
    return storedProjectSnapshotSchema.parse({
      projectId: snapshot.project.id,
      createdAt: metadata.createdAt,
      kind: metadata.kind,
      named: metadata.kind === "named",
      ...(metadata.name ? { name: metadata.name } : {}),
      ...(metadata.reason ? { reason: metadata.reason } : {}),
      ...(metadata.revisionId ? { revisionId: metadata.revisionId } : {}),
      projectSnapshot: snapshot,
      binaryHashes,
    });
  }

  private async prune(projectId: string, kind: SnapshotKind, keep: number): Promise<void> {
    if (kind === "named" || keep < 1) {
      return;
    }
    const records = (await this.snapshots.list(projectId)).filter(
      (snapshot) => snapshot.kind === kind,
    );
    for (const stale of records.slice(keep)) {
      await this.snapshots.delete(stale.projectId, stale.createdAt);
    }
  }
}
