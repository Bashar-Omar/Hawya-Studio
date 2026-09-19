import { describe, expect, it } from "vitest";

import { MigrationError } from "@/domain/project/errors";
import { migrateProjectSnapshot } from "@/domain/project/migrations";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import { createSyntheticProjectFixture } from "../../../tests/fixtures/stage02/synthetic-project";

describe("project migrations", () => {
  it("accepts schema version 1 without mutating the source", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const source = structuredClone(fixture.snapshot);
    expect(migrateProjectSnapshot(source)).toEqual(fixture.snapshot);
    expect(source).toEqual(fixture.snapshot);
  });

  it("rejects a future schema version explicitly", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const future = structuredClone(fixture.snapshot) as unknown as {
      project: { schemaVersion: number };
    };
    future.project.schemaVersion = 2;
    expect(() => migrateProjectSnapshot(future)).toThrow(MigrationError);
  });
});
