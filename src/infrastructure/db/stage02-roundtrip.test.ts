import { afterEach, describe, expect, it } from "vitest";

import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import { ExportProjectArchiveUseCase } from "@/application/use-cases/export-project-archive";
import { ImportProjectArchiveUseCase } from "@/application/use-cases/import-project-archive";
import { PutBinaryContentUseCase } from "@/application/use-cases/put-binary-content";
import {
  type ISODateTime,
  isoDateTimeSchema,
  type UUID,
  uuidSchema,
} from "@/domain/common/primitives";
import { rebaseProjectSnapshotId } from "@/domain/project/hawya-project";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import { IndexedDbBinaryStore } from "@/infrastructure/binary-store/indexeddb-binary-store";
import { DexieProjectRepository } from "@/infrastructure/db/dexie-project-repository";
import { HawyaDatabase } from "@/infrastructure/db/hawya-database";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  fontBytes,
  sharedImageBytes,
  SYNTHETIC_IMPORT_ID,
  SYNTHETIC_SAVE_TIMESTAMP,
} from "../../../tests/fixtures/stage02/synthetic-project";

class FixedClock implements Clock {
  constructor(private readonly value: ISODateTime) {}
  now(): ISODateTime {
    return this.value;
  }
}

class FixedIdGenerator implements IdGenerator {
  constructor(private readonly value: UUID) {}
  newId(): UUID {
    return this.value;
  }
}

const databases: HawyaDatabase[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close();
    await database.delete();
  }
});

describe("Stage 02 persistence and project archive gate", () => {
  it("persists, reloads, exports, clears storage, imports under a new ID and preserves checksums", async () => {
    const databaseName = `hawya-stage02-${crypto.randomUUID()}`;
    const clock = new FixedClock(isoDateTimeSchema.parse(SYNTHETIC_SAVE_TIMESTAMP));
    const hasher = new WebCryptoSha256Hasher();
    const fixture = await createSyntheticProjectFixture(hasher);

    const sourceDb = new HawyaDatabase(databaseName);
    databases.push(sourceDb);
    const sourceProjects = new DexieProjectRepository(sourceDb);
    const sourceBinaries = new IndexedDbBinaryStore(sourceDb, clock);
    const putBinary = new PutBinaryContentUseCase(hasher, sourceBinaries);

    const firstImage = await putBinary.execute({ bytes: sharedImageBytes, mime: "image/svg+xml" });
    const duplicateImage = await putBinary.execute({
      bytes: sharedImageBytes,
      mime: "image/svg+xml",
    });
    const font = await putBinary.execute({ bytes: fontBytes, mime: "font/woff2" });
    expect(firstImage.inserted).toBe(true);
    expect(duplicateImage).toEqual({ contentHash: firstImage.contentHash, inserted: false });
    expect(font.inserted).toBe(true);
    expect(await sourceDb.binaries.count()).toBe(2);

    await sourceProjects.save(fixture.snapshot);
    const reloaded = await sourceProjects.get(fixture.snapshot.project.id);
    expect(reloaded).toEqual(fixture.snapshot);

    const codec = new FflateProjectArchiveCodec(hasher, clock);
    const exporter = new ExportProjectArchiveUseCase(sourceProjects, sourceBinaries, codec);
    const exported = await exporter.execute(fixture.snapshot.project.id);
    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      throw exported.error;
    }

    sourceDb.close();
    await sourceDb.delete();
    databases.splice(databases.indexOf(sourceDb), 1);

    const importedDb = new HawyaDatabase(databaseName);
    databases.push(importedDb);
    const importedProjects = new DexieProjectRepository(importedDb);
    const importedBinaries = new IndexedDbBinaryStore(importedDb, clock);
    const importer = new ImportProjectArchiveUseCase(
      codec,
      importedProjects,
      importedBinaries,
      new FixedIdGenerator(uuidSchema.parse(SYNTHETIC_IMPORT_ID)),
    );

    const imported = await importer.execute(exported.value);
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      throw imported.error;
    }

    const expected = rebaseProjectSnapshotId(
      fixture.snapshot,
      uuidSchema.parse(SYNTHETIC_IMPORT_ID),
    );
    expect(imported.value).toEqual(expected);
    expect(await importedProjects.get(imported.value.project.id)).toEqual(expected);
    expect(await importedDb.binaries.count()).toBe(2);

    for (const binary of fixture.binaries) {
      const restored = await importedBinaries.get(binary.contentHash);
      expect(restored?.contentHash).toBe(binary.contentHash);
      expect(restored ? [...restored.bytes] : undefined).toEqual([...binary.bytes]);
      expect(await hasher.hash(restored?.bytes ?? new Uint8Array())).toBe(binary.contentHash);
    }
  });
});
