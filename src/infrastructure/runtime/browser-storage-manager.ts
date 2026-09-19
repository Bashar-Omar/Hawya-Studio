import type { StorageDiagnostics, StorageManagerPort } from "@/application/ports/storage-manager";

export class BrowserStorageManager implements StorageManagerPort {
  async diagnostics(): Promise<StorageDiagnostics> {
    if (typeof navigator === "undefined" || !navigator.storage) {
      return { supported: false, persisted: undefined, usage: undefined, quota: undefined };
    }

    const [persisted, estimate] = await Promise.all([
      navigator.storage.persisted?.().catch(() => undefined),
      navigator.storage.estimate?.().catch(() => undefined),
    ]);

    return {
      supported: true,
      persisted,
      usage: estimate?.usage,
      quota: estimate?.quota,
    };
  }

  async requestPersistence(): Promise<boolean | undefined> {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return undefined;
    }
    try {
      return await navigator.storage.persist();
    } catch {
      return undefined;
    }
  }
}
