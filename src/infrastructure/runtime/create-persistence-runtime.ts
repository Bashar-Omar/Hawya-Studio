import { DeleteProjectUseCase } from "@/application/use-cases/delete-project";
import { ExportProjectArchiveUseCase } from "@/application/use-cases/export-project-archive";
import { GarbageCollectBinariesUseCase } from "@/application/use-cases/garbage-collect-binaries";
import { ImportProjectArchiveUseCase } from "@/application/use-cases/import-project-archive";
import { PutBinaryContentUseCase } from "@/application/use-cases/put-binary-content";
import { SaveProjectUseCase } from "@/application/use-cases/save-project";
import { ProjectSnapshotService } from "@/application/use-cases/project-snapshots";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import { IndexedDbBinaryStore } from "@/infrastructure/binary-store/indexeddb-binary-store";
import { DexieBinaryReferenceIndex } from "@/infrastructure/db/dexie-binary-reference-index";
import { DexieProjectRepository } from "@/infrastructure/db/dexie-project-repository";
import { DexieSnapshotRepository } from "@/infrastructure/db/dexie-snapshot-repository";
import { HawyaDatabase } from "@/infrastructure/db/hawya-database";
import { CryptoIdGenerator } from "@/infrastructure/runtime/crypto-id-generator";
import { SystemClock } from "@/infrastructure/runtime/system-clock";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";

export function createPersistenceRuntime(databaseName?: string) {
  const database = new HawyaDatabase(databaseName);
  const clock = new SystemClock();
  const ids = new CryptoIdGenerator();
  const hasher = new WebCryptoSha256Hasher();
  const projects = new DexieProjectRepository(database);
  const snapshots = new DexieSnapshotRepository(database);
  const binaries = new IndexedDbBinaryStore(database, clock);
  const binaryReferences = new DexieBinaryReferenceIndex(database);
  const garbageCollectBinaries = new GarbageCollectBinariesUseCase(binaries, binaryReferences);
  const archiveCodec = new FflateProjectArchiveCodec(hasher, clock);

  return {
    database,
    clock,
    ids,
    hasher,
    projects,
    snapshots,
    binaries,
    binaryReferences,
    archiveCodec,
    saveProject: new SaveProjectUseCase(projects, clock),
    putBinaryContent: new PutBinaryContentUseCase(hasher, binaries),
    garbageCollectBinaries,
    deleteProject: new DeleteProjectUseCase(projects, garbageCollectBinaries),
    projectSnapshots: new ProjectSnapshotService(snapshots, projects, clock, ids),
    exportProjectArchive: new ExportProjectArchiveUseCase(projects, binaries, archiveCodec),
    importProjectArchive: new ImportProjectArchiveUseCase(archiveCodec, projects, binaries, ids),
  };
}
