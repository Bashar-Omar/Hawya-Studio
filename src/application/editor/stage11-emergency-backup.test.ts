import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { BinaryStore, StoredBinary } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectListItem, ProjectRepository } from "@/application/ports/project-repository";
import { EditorSession } from "@/application/editor/editor-session";
import { ExportProjectSnapshotArchiveUseCase } from "@/application/use-cases/export-project-snapshot-archive";
import { type ISODateTime, isoDateTimeSchema, uuidSchema } from "@/domain/common/primitives";
import { StorageError } from "@/domain/project/errors";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_SAVE_TIMESTAMP,
  createSyntheticProjectFixture,
} from "../../../tests/fixtures/stage02/synthetic-project";

class FixedClock implements Clock {
  constructor(private readonly value: ISODateTime) {}
  now(): ISODateTime {
    return this.value;
  }
}

class SequenceIds implements IdGenerator {
  private next = 0;

  newId() {
    this.next += 1;
    return uuidSchema.parse(`00000000-0000-4000-8000-${String(this.next).padStart(12, "0")}`);
  }
}

class MemoryBinaryStore implements BinaryStore {
  private readonly values: Map<string, StoredBinary>;

  constructor(entries: readonly StoredBinary[]) {
    this.values = new Map(entries.map((entry) => [entry.contentHash, entry]));
  }

  async has(contentHash: string) {
    return this.values.has(contentHash);
  }

  async get(contentHash: string) {
    return this.values.get(contentHash);
  }

  async put() {
    return { inserted: false };
  }

  async listContentHashes() {
    return [...this.values.keys()];
  }

  async delete() {}
}

class FailingProjectRepository implements ProjectRepository {
  durable: ProjectSnapshot;
  failWrites = true;

  constructor(snapshot: ProjectSnapshot) {
    this.durable = structuredClone(snapshot);
  }

  async save(snapshot: ProjectSnapshot): Promise<void> {
    if (this.failWrites) {
      throw new StorageError(
        "transaction-failed",
        "Stage 11 simulated IndexedDB quota failure",
        new DOMException("Quota exceeded", "QuotaExceededError"),
      );
    }
    this.durable = structuredClone(snapshot);
  }

  async get(projectId: ProjectId): Promise<ProjectSnapshot | undefined> {
    return projectId === this.durable.project.id ? structuredClone(this.durable) : undefined;
  }

  async listMetadata(): Promise<ProjectListItem[]> {
    return [{ id: this.durable.project.id, metadata: this.durable.project.metadata }];
  }

  async delete(): Promise<void> {}
}

describe("Stage 11 emergency backup recovery", () => {
  it("keeps failed editor writes in memory, exports them, then persists the same snapshot on retry", async () => {
    const hasher = new WebCryptoSha256Hasher();
    const fixture = await createSyntheticProjectFixture(hasher);
    const repository = new FailingProjectRepository(fixture.snapshot);
    const clock = new FixedClock(isoDateTimeSchema.parse(SYNTHETIC_SAVE_TIMESTAMP));
    const session = await EditorSession.open(
      repository,
      clock,
      new SequenceIds(),
      fixture.snapshot.project.id,
      SYNTHETIC_PAGE_ID,
    );

    await expect(session.addText(120, 160, "Unsaved emergency text")).rejects.toBeInstanceOf(
      StorageError,
    );

    expect(session.hasPendingPersistence()).toBe(true);
    const volatilePage = session.projectSnapshot().project.guide.pages[SYNTHETIC_PAGE_ID];
    const durablePage = repository.durable.project.guide.pages[SYNTHETIC_PAGE_ID];
    expect(
      volatilePage?.extras.some(
        (layer) => layer.type === "text" && layer.content === "Unsaved emergency text",
      ),
    ).toBe(true);
    expect(durablePage?.extras).toHaveLength(0);

    const emergencyLayer = volatilePage?.extras.find(
      (layer) => layer.type === "text" && layer.content === "Unsaved emergency text",
    );
    if (!emergencyLayer) throw new Error("Emergency text layer was not preserved in memory");
    await expect(
      session.updateText(emergencyLayer.id, "Unsaved emergency text v2"),
    ).rejects.toBeInstanceOf(StorageError);
    expect(
      session
        .projectSnapshot()
        .project.guide.pages[SYNTHETIC_PAGE_ID]?.extras.some(
          (layer) => layer.type === "text" && layer.content === "Unsaved emergency text v2",
        ),
    ).toBe(true);
    expect(repository.durable.project.guide.pages[SYNTHETIC_PAGE_ID]?.extras).toHaveLength(0);

    const binaries = new MemoryBinaryStore(
      fixture.binaries.map((binary) => ({
        ...binary,
        byteLength: binary.bytes.byteLength,
      })),
    );
    const codec = new FflateProjectArchiveCodec(hasher, clock);
    const exporter = new ExportProjectSnapshotArchiveUseCase(binaries, codec);
    const emergency = await exporter.execute(session.projectSnapshot());
    expect(emergency.ok).toBe(true);
    if (!emergency.ok) throw emergency.error;

    const entries = unzipSync(emergency.value);
    const projectBytes = entries["project.json"];
    if (!projectBytes) throw new Error("Emergency archive is missing project.json");
    const archived = JSON.parse(strFromU8(projectBytes)) as ProjectSnapshot;
    const archivedPage = archived.project.guide.pages[SYNTHETIC_PAGE_ID];
    expect(
      archivedPage?.extras.some(
        (layer) => layer.type === "text" && layer.content === "Unsaved emergency text v2",
      ),
    ).toBe(true);

    repository.failWrites = false;
    await session.retryPersistence();
    expect(session.hasPendingPersistence()).toBe(false);
    expect(repository.durable).toEqual(session.projectSnapshot());
  });
});
