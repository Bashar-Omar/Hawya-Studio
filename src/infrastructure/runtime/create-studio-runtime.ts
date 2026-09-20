import { BrowserProjectFiles } from "@/infrastructure/file-system/browser-project-files";
import { BrowserAssetFiles } from "@/infrastructure/file-system/browser-asset-files";
import { createPersistenceRuntime } from "@/infrastructure/runtime/create-persistence-runtime";
import { BrowserStorageManager } from "@/infrastructure/runtime/browser-storage-manager";

export function createStudioRuntime(databaseName?: string) {
  return {
    ...createPersistenceRuntime(databaseName),
    projectFiles: new BrowserProjectFiles(),
    assetFiles: new BrowserAssetFiles(),
    storageManager: new BrowserStorageManager(),
  };
}

export type StudioRuntime = ReturnType<typeof createStudioRuntime>;
