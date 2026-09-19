import { describe, expect, it, vi } from "vitest";

import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { SnapshotRepository } from "@/application/ports/snapshot-repository";
import { ProjectSnapshotService } from "@/application/use-cases/project-snapshots";
import {
  type ISODateTime,
  isoDateTimeSchema,
  type UUID,
  uuidSchema,
} from "@/domain/common/primitives";
import type { StoredProjectSnapshot } from "@/domain/project/snapshot";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import { createSyntheticProjectFixture } from "../../../tests/fixtures/stage02/synthetic-project";

class SequenceClock implements Clock {
  private index = 0;

  constructor(private readonly values: readonly ISODateTime[]) {}

  now(): ISODateTime {
    const value = this.values[this.index];
    if (!value) {
      throw new Error("SequenceClock exhausted");
    }
    this.index += 1;
    return value;
  }
}

class SequenceIds implements IdGenerator {
  private index = 0;

  constructor(private readonly values: readonly UUID[]) {}

  newId(): UUID {
    const value = this.values[this.index];
    if (!value) {
      throw new Error("SequenceIds exhausted");
    }
    this.index += 1;
    return value;
  }
}

describe("ProjectSnapshotService", () => {
  it("keeps named snapshots and prunes rolling recovery snapshots", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const records: StoredProjectSnapshot[] = [];
    const snapshotRepository: SnapshotRepository = {
      put: vi.fn(async (snapshot) => {
        records.push(snapshot);
      }),
      list: vi.fn(async () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      delete: vi.fn(async (projectId, createdAt) => {
        const index = records.findIndex(
          (record) => record.projectId === projectId && record.createdAt === createdAt,
        );
        if (index >= 0) {
          records.splice(index, 1);
        }
      }),
    };
    let savedProject = fixture.snapshot;
    const projectRepository: ProjectRepository = {
      save: vi.fn(async (snapshot) => {
        savedProject = snapshot;
      }),
      get: vi.fn(),
      listMetadata: vi.fn(),
      delete: vi.fn(),
    };
    const clock = new SequenceClock([
      isoDateTimeSchema.parse("2026-09-19T10:10:00.000Z"),
      isoDateTimeSchema.parse("2026-09-19T10:11:00.000Z"),
      isoDateTimeSchema.parse("2026-09-19T10:12:00.000Z"),
      isoDateTimeSchema.parse("2026-09-19T10:13:00.000Z"),
    ]);
    const ids = new SequenceIds([uuidSchema.parse("00000000-0000-4000-8000-000000000090")]);
    const service = new ProjectSnapshotService(snapshotRepository, projectRepository, clock, ids, {
      autosave: 2,
      recovery: 2,
    });

    await service.createRecoverySnapshot(fixture.snapshot, "before risky operation 1");
    await service.createRecoverySnapshot(fixture.snapshot, "before risky operation 2");
    await service.createRecoverySnapshot(fixture.snapshot, "before risky operation 3");
    expect(records.filter((record) => record.kind === "recovery")).toHaveLength(2);

    const withRevision = await service.createNamedSnapshot(fixture.snapshot, "Client Final");
    expect(withRevision.project.revisions).toHaveLength(1);
    expect(withRevision.project.revisions[0]?.name).toBe("Client Final");
    expect(savedProject.project.revisions).toEqual(withRevision.project.revisions);
    const named = records.find((record) => record.kind === "named");
    expect(named?.binaryHashes).toHaveLength(2);
  });
});
