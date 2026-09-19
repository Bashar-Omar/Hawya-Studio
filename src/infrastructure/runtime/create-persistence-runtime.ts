import { ProjectLibraryQuery } from "@/application/queries/project-library-query";
import { CreateProjectUseCase } from "@/application/use-cases/create-project";
import { DeleteProjectUseCase } from "@/application/use-cases/delete-project";
import { DeleteStudioProjectUseCase } from "@/application/use-cases/delete-studio-project";
import { DuplicateProjectUseCase } from "@/application/use-cases/duplicate-project";
import { ExportProjectArchiveUseCase } from "@/application/use-cases/export-project-archive";
import { ExportProjectBackupUseCase } from "@/application/use-cases/export-project-backup";
import { GarbageCollectBinariesUseCase } from "@/application/use-cases/garbage-collect-binaries";
import { ImportProjectArchiveUseCase } from "@/application/use-cases/import-project-archive";
import { OpenProjectUseCase } from "@/application/use-cases/open-project";
import { ProjectSetupWizardUseCase } from "@/application/use-cases/project-setup-wizard";
import { ProjectSnapshotService } from "@/application/use-cases/project-snapshots";
import { PutBinaryContentUseCase } from "@/application/use-cases/put-binary-content";
import { RenameProjectUseCase } from "@/application/use-cases/rename-project";
import { SaveProjectUseCase } from "@/application/use-cases/save-project";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import { IndexedDbBinaryStore } from "@/infrastructure/binary-store/indexeddb-binary-store";
import { DexieBinaryReferenceIndex } from "@/infrastructure/db/dexie-binary-reference-index";
import { DexieProjectRepository } from "@/infrastructure/db/dexie-project-repository";
import { DexieSetupDraftRepository } from "@/infrastructure/db/dexie-setup-draft-repository";
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
  const setupDrafts = new DexieSetupDraftRepository(database);
  const binaries = new IndexedDbBinaryStore(database, clock);
  const binaryReferences = new DexieBinaryReferenceIndex(database);
  const garbageCollectBinaries = new GarbageCollectBinariesUseCase(binaries, binaryReferences);
  const archiveCodec = new FflateProjectArchiveCodec(hasher, clock);
  const exportProjectArchive = new ExportProjectArchiveUseCase(projects, binaries, archiveCodec);
  const deleteProject = new DeleteProjectUseCase(projects, garbageCollectBinaries);

  return {
    database,
    clock,
    ids,
    hasher,
    projects,
    snapshots,
    setupDrafts,
    binaries,
    binaryReferences,
    archiveCodec,
    saveProject: new SaveProjectUseCase(projects, clock),
    putBinaryContent: new PutBinaryContentUseCase(hasher, binaries),
    garbageCollectBinaries,
    deleteProject,
    deleteStudioProject: new DeleteStudioProjectUseCase(deleteProject, setupDrafts),
    projectSnapshots: new ProjectSnapshotService(snapshots, projects, clock, ids),
    exportProjectArchive,
    exportProjectBackup: new ExportProjectBackupUseCase(exportProjectArchive, projects, clock),
    importProjectArchive: new ImportProjectArchiveUseCase(archiveCodec, projects, binaries, ids),
    createProject: new CreateProjectUseCase(projects, setupDrafts, clock, ids),
    renameProject: new RenameProjectUseCase(projects, clock),
    duplicateProject: new DuplicateProjectUseCase(projects, setupDrafts, clock, ids),
    openProject: new OpenProjectUseCase(projects, clock),
    setupWizard: new ProjectSetupWizardUseCase(projects, setupDrafts, clock, ids),
    projectLibrary: new ProjectLibraryQuery(projects, setupDrafts),
  };
}

export type PersistenceRuntime = ReturnType<typeof createPersistenceRuntime>;
