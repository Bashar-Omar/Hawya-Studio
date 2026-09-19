import { BrowserProjectFiles } from "@/infrastructure/file-system/browser-project-files";
import { createPersistenceRuntime } from "@/infrastructure/runtime/create-persistence-runtime";
import { BrowserStorageManager } from "@/infrastructure/runtime/browser-storage-manager";

export function createStudioRuntime(databaseName?: string) {
  return {
    ...createPersistenceRuntime(databaseName),
    projectFiles: new BrowserProjectFiles(),
    storageManager: new BrowserStorageManager(),
  };
}

export type StudioRuntime = ReturnType<typeof createStudioRuntime>;
