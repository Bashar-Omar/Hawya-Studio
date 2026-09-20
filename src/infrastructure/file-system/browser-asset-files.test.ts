import { describe, expect, it, vi } from "vitest";

import { ASSET_HARD_LIMIT_BYTES } from "@/domain/assets/asset-policy";
import { BrowserAssetFiles } from "@/infrastructure/file-system/browser-asset-files";

describe("BrowserAssetFiles", () => {
  it("rejects an oversized file before reading its bytes", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    const file = {
      name: "oversized.png",
      type: "image/png",
      size: ASSET_HARD_LIMIT_BYTES + 1,
      arrayBuffer,
    } as unknown as File;

    await expect(new BrowserAssetFiles().read(file)).rejects.toThrow(
      "Asset exceeds Hawya's hard local safety limit",
    );
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
