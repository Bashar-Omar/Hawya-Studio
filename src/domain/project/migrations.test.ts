import { describe, expect, it } from "vitest";

import { MigrationError } from "@/domain/project/errors";
import { migrateProjectSnapshot } from "@/domain/project/migrations";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/domain/project/schema-version";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import { createSyntheticProjectFixture } from "../../../tests/fixtures/stage02/synthetic-project";

describe("project migrations", () => {
  it("accepts the current schema without mutating the source", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const source = structuredClone(fixture.snapshot);
    expect(migrateProjectSnapshot(source)).toEqual(fixture.snapshot);
    expect(source).toEqual(fixture.snapshot);
  });

  it("migrates schema v1 projects to v2 with an empty mockup collection", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const legacy = structuredClone(fixture.snapshot) as unknown as {
      project: Record<string, unknown> & { schemaVersion: number };
    };
    legacy.project.schemaVersion = 1;
    delete legacy.project.mockups;

    const migrated = migrateProjectSnapshot(legacy);
    expect(migrated.project.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
    expect(migrated.project.mockups).toEqual({ presets: [] });
    expect(legacy.project.schemaVersion).toBe(1);
    expect("mockups" in legacy.project).toBe(false);
  });

  it("rejects a future schema version explicitly", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const future = structuredClone(fixture.snapshot) as unknown as {
      project: { schemaVersion: number };
    };
    future.project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION + 1;
    expect(() => migrateProjectSnapshot(future)).toThrow(MigrationError);
  });
});
