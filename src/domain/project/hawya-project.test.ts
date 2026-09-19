import { describe, expect, it } from "vitest";

import { uuidSchema } from "@/domain/common/primitives";
import { projectSnapshotSchema, rebaseProjectSnapshotId } from "@/domain/project/hawya-project";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_IMPORT_ID,
} from "../../../tests/fixtures/stage02/synthetic-project";

describe("canonical project schema", () => {
  it("rejects missing asset references", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const invalid = {
      ...fixture.snapshot,
      assets: fixture.snapshot.assets.slice(1),
    };
    expect(projectSnapshotSchema.safeParse(invalid).success).toBe(false);
  });

  it("rebases project-local identity without changing semantic content", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const rebased = rebaseProjectSnapshotId(
      fixture.snapshot,
      uuidSchema.parse(SYNTHETIC_IMPORT_ID),
    );
    expect(rebased.project.id).toBe(SYNTHETIC_IMPORT_ID);
    expect(rebased.assets.every((asset) => asset.projectId === SYNTHETIC_IMPORT_ID)).toBe(true);
    expect(rebased.project.brand).toEqual(fixture.snapshot.project.brand);
    expect(rebased.project.guide).toEqual(fixture.snapshot.project.guide);
  });
});
