import { afterEach, describe, expect, it } from "vitest";

import { DeleteProjectUseCase } from "@/application/use-cases/delete-project";
import { GarbageCollectBinariesUseCase } from "@/application/use-cases/garbage-collect-binaries";
import type { Clock } from "@/application/ports/clock";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import { IndexedDbBinaryStore } from "@/infrastructure/binary-store/indexeddb-binary-store";
import { DexieBinaryReferenceIndex } from "@/infrastructure/db/dexie-binary-reference-index";
import { DexieProjectRepository } from "@/infrastructure/db/dexie-project-repository";
import { HawyaDatabase } from "@/infrastructure/db/hawya-database";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  SYNTHETIC_IMPORT_ID,
  createSyntheticProjectFixture,
} from "../../../tests/fixtures/stage02/synthetic-project";

const clock: Clock = { now: () => "2026-09-19T10:00:00.000Z" };
const databases: HawyaDatabase[] = [];

afterEach(async () => {
  for (const db of databases.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe("DeleteProjectUseCase", () => {
  it("keeps shared hashes until no project or snapshot references them", async () => {
    const db = new HawyaDatabase(`hawya-gc-${crypto.randomUUID()}`);
    databases.push(db);
    const projects = new DexieProjectRepository(db);
    const binaryStore = new IndexedDbBinaryStore(db, clock);
    const references = new DexieBinaryReferenceIndex(db);
    const gc = new GarbageCollectBinariesUseCase(binaryStore, references);
    const deleteProject = new DeleteProjectUseCase(projects, gc);
    const hasher = new WebCryptoSha256Hasher();
    const fixture = await createSyntheticProjectFixture(hasher);

    for (const binary of fixture.binaries) {
      await binaryStore.put(binary);
    }

    await projects.save(fixture.snapshot);
    const secondProject: ProjectSnapshot = {
      ...fixture.snapshot,
      project: {
        ...fixture.snapshot.project,
        id: SYNTHETIC_IMPORT_ID,
        metadata: {
          ...fixture.snapshot.project.metadata,
          name: "Second project sharing binaries",
        },
      },
      assets: fixture.snapshot.assets.map((asset) => ({
        ...asset,
        projectId: SYNTHETIC_IMPORT_ID,
      })),
    };
    await projects.save(secondProject);

    await deleteProject.execute(fixture.snapshot.project.id);
    expect(await binaryStore.listContentHashes()).toHaveLength(2);

    await deleteProject.execute(secondProject.project.id);
    expect(await binaryStore.listContentHashes()).toEqual([]);
  });
});
