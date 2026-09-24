import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserStorageManager } from "@/infrastructure/runtime/browser-storage-manager";

describe("BrowserStorageManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports unsupported storage APIs without throwing", async () => {
    vi.stubGlobal("navigator", undefined);

    await expect(new BrowserStorageManager().diagnostics()).resolves.toEqual({
      supported: false,
      persisted: undefined,
      usage: undefined,
      quota: undefined,
    });
    await expect(new BrowserStorageManager().requestPersistence()).resolves.toBeUndefined();
  });

  it("reports quota, usage and persistence state", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persisted: vi.fn().mockResolvedValue(true),
        estimate: vi.fn().mockResolvedValue({ usage: 12_345, quota: 98_765 }),
        persist: vi.fn().mockResolvedValue(true),
      },
    });

    await expect(new BrowserStorageManager().diagnostics()).resolves.toEqual({
      supported: true,
      persisted: true,
      usage: 12_345,
      quota: 98_765,
    });
    await expect(new BrowserStorageManager().requestPersistence()).resolves.toBe(true);
  });

  it("degrades rejected browser diagnostics to unknown values", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persisted: vi.fn().mockRejectedValue(new Error("blocked")),
        estimate: vi.fn().mockRejectedValue(new Error("blocked")),
      },
    });

    await expect(new BrowserStorageManager().diagnostics()).resolves.toEqual({
      supported: true,
      persisted: undefined,
      usage: undefined,
      quota: undefined,
    });
  });

  it("degrades a rejected persistence request instead of crashing the app", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persist: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });

    await expect(new BrowserStorageManager().requestPersistence()).resolves.toBeUndefined();
  });
});
