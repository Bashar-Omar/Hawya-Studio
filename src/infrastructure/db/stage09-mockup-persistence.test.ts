import { afterEach, describe, expect, it } from "vitest";

import { cloneDefaultMockupQuad } from "@/domain/mockup/mockup";
import { projectSnapshotSchema } from "@/domain/project/hawya-project";
import { DexieProjectRepository } from "@/infrastructure/db/dexie-project-repository";
import { HawyaDatabase } from "@/infrastructure/db/hawya-database";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_DUPLICATE_ASSET_ID,
  SYNTHETIC_LOGO_ASSET_ID,
  SYNTHETIC_PROJECT_ID,
  SYNTHETIC_TIMESTAMP,
} from "../../../tests/fixtures/stage02/synthetic-project";

const MOCKUP_ASSET_ID = "00000000-0000-4000-8000-000000000911";
const MOCKUP_PRESET_ID = "00000000-0000-4000-8000-000000000912";

const databases: HawyaDatabase[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close();
    await database.delete();
  }
});

describe("Stage 09 mockup persistence", () => {
  it("round-trips canonical mockup presets after a database reopen", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const sourceAsset = fixture.snapshot.assets.find(
      (asset) => asset.id === SYNTHETIC_DUPLICATE_ASSET_ID,
    );
    if (!sourceAsset) throw new Error("Synthetic image asset is missing");

    const snapshot = projectSnapshotSchema.parse({
      ...fixture.snapshot,
      project: {
        ...fixture.snapshot.project,
        assetRefs: [...fixture.snapshot.project.assetRefs, { assetId: MOCKUP_ASSET_ID }],
        mockups: {
          presets: [
            {
              id: MOCKUP_PRESET_ID,
              name: "Stationery preset",
              backgroundAssetId: MOCKUP_ASSET_ID,
              crop: { x: 0.05, y: 0.1, width: 0.9, height: 0.8 },
              surface: {
                corners: cloneDefaultMockupQuad(),
                artwork: { kind: "asset", assetId: SYNTHETIC_LOGO_ASSET_ID },
                opacity: 0.92,
                blendMode: "multiply",
                shadowStrength: 0.2,
                highlightStrength: 0.08,
              },
              createdAt: SYNTHETIC_TIMESTAMP,
              updatedAt: SYNTHETIC_TIMESTAMP,
            },
          ],
        },
      },
      assets: [
        ...fixture.snapshot.assets,
        {
          ...sourceAsset,
          id: MOCKUP_ASSET_ID,
          kind: "mockup",
          name: "Desk mockup",
          originalFilename: "desk.png",
          mime: "image/png",
          extension: "png",
          security: {},
        },
      ],
    });

    const databaseName = `hawya-stage09-${crypto.randomUUID()}`;
    const firstDb = new HawyaDatabase(databaseName);
    databases.push(firstDb);
    await new DexieProjectRepository(firstDb).save(snapshot);

    firstDb.close();
    databases.splice(databases.indexOf(firstDb), 1);

    const reopenedDb = new HawyaDatabase(databaseName);
    databases.push(reopenedDb);
    const reloaded = await new DexieProjectRepository(reopenedDb).get(SYNTHETIC_PROJECT_ID);

    expect(reloaded).toEqual(snapshot);
    expect(reloaded?.project.mockups.presets[0]?.surface?.artwork).toEqual({
      kind: "asset",
      assetId: SYNTHETIC_LOGO_ASSET_ID,
    });
  });
});
