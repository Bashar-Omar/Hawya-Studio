import { describe, expect, it } from "vitest";

import { appMetadata } from "@/app/app-metadata";

describe("appMetadata", () => {
  it("keeps the product local-first", () => {
    expect(appMetadata.architecture).toBe("local-first");
  });

  it("keeps both product names available from the foundation", () => {
    expect(appMetadata.name).toBe("Hawya Studio");
    expect(appMetadata.arabicName).toBe("ستديو هوية");
  });
});
