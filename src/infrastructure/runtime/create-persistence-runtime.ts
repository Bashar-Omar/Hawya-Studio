import { BrandSystemQuery } from "@/application/queries/brand-system-query";
import { GuideStudioQuery } from "@/application/queries/guide-studio-query";
import { AssetIngestor } from "@/application/services/asset-ingestor";
import { DeleteAssetUseCase } from "@/application/use-cases/delete-asset";
import { ImportAssetUseCase } from "@/application/use-cases/import-asset";
import { ImportFontUseCase } from "@/application/use-cases/import-font";
import { LoadProjectFontsUseCase } from "@/application/use-cases/load-project-fonts";
import { ManageColorTokensUseCase } from "@/application/use-cases/manage-color-tokens";
import { ManageLogoVariantsUseCase } from "@/application/use-cases/manage-logo-variants";
import { ManageTextStylesUseCase } from "@/application/use-cases/manage-text-styles";
import { ReplaceAssetUseCase } from "@/application/use-cases/replace-asset";
import { UpdateAssetTagsUseCase } from "@/application/use-cases/update-asset-tags";
import { ProjectLibraryQuery } from "@/application/queries/project-library-query";
import { CreateProjectUseCase } from "@/application/use-cases/create-project";
import { DeleteProjectUseCase } from "@/application/use-cases/delete-project";
import { DeleteStudioProjectUseCase } from "@/application/use-cases/delete-studio-project";
import { DuplicateProjectUseCase } from "@/application/use-cases/duplicate-project";
import { ExportProjectArchiveUseCase } from "@/application/use-cases/export-project-archive";
import { ExportProjectBackupUseCase } from "@/application/use-cases/export-project-backup";
import { GarbageCollectBinariesUseCase } from "@/application/use-cases/garbage-collect-binaries";
import { GenerateGuideUseCase } from "@/application/use-cases/generate-guide";
import { ImportProjectArchiveUseCase } from "@/application/use-cases/import-project-archive";
import { OpenProjectUseCase } from "@/application/use-cases/open-project";
import { ProjectSetupWizardUseCase } from "@/application/use-cases/project-setup-wizard";
import { ProjectSnapshotService } from "@/application/use-cases/project-snapshots";
import { PutBinaryContentUseCase } from "@/application/use-cases/put-binary-content";
import { RenameProjectUseCase } from "@/application/use-cases/rename-project";
import { ResetGuidePageTemplateUseCase } from "@/application/use-cases/reset-guide-page-template";
import { SwitchGuidePageTemplateUseCase } from "@/application/use-cases/switch-guide-page-template";
import { SaveProjectUseCase } from "@/application/use-cases/save-project";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import { IndexedDbBinaryStore } from "@/infrastructure/binary-store/indexeddb-binary-store";
import { ColorJsColorEngine } from "@/infrastructure/analysis/color-js-color-engine";
import { WorkerFontAnalyzer } from "@/infrastructure/analysis/worker-font-analyzer";
import { WorkerRasterAnalyzer } from "@/infrastructure/analysis/worker-raster-analyzer";
import { BrowserFontRegistry } from "@/infrastructure/fonts/browser-font-registry";
import { DomPurifySvgSanitizer } from "@/infrastructure/sanitization/dompurify-svg-sanitizer";
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
  const svgSanitizer = new DomPurifySvgSanitizer();
  const fontAnalyzer = new WorkerFontAnalyzer();
  const rasterAnalyzer = new WorkerRasterAnalyzer();
  const fontRegistry = new BrowserFontRegistry();
  const colorEngine = new ColorJsColorEngine();
  const assetIngestor = new AssetIngestor(
    hasher,
    binaries,
    svgSanitizer,
    fontAnalyzer,
    rasterAnalyzer,
    clock,
  );
  const importAsset = new ImportAssetUseCase(projects, assetIngestor, clock, ids);
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
    assetIngestor,
    importAsset,
    replaceAsset: new ReplaceAssetUseCase(projects, assetIngestor, garbageCollectBinaries, clock),
    updateAssetTags: new UpdateAssetTagsUseCase(projects, clock),
    deleteAsset: new DeleteAssetUseCase(projects, garbageCollectBinaries, clock),
    logoVariants: new ManageLogoVariantsUseCase(projects, clock, ids),
    colorTokens: new ManageColorTokensUseCase(projects, colorEngine, clock, ids),
    importFont: new ImportFontUseCase(importAsset, projects, binaries, fontRegistry, clock, ids),
    loadProjectFonts: new LoadProjectFontsUseCase(projects, binaries, fontRegistry),
    textStyles: new ManageTextStylesUseCase(projects, clock, ids),
    brandSystem: new BrandSystemQuery(projects),
    guideStudio: new GuideStudioQuery(projects),
    generateGuide: new GenerateGuideUseCase(projects, clock, ids),
    switchGuidePageTemplate: new SwitchGuidePageTemplateUseCase(projects, clock),
    resetGuidePageTemplate: new ResetGuidePageTemplateUseCase(projects, clock),
    fontRegistry,
    colorEngine,
  };
}

export type PersistenceRuntime = ReturnType<typeof createPersistenceRuntime>;
