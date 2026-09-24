import { describe, expect, it } from "vitest";

import type { ProjectRepository } from "@/application/ports/project-repository";
import type { SetupDraftRepository } from "@/application/ports/setup-draft-repository";
import { GuideStudioQuery } from "@/application/queries/guide-studio-query";
import { ProjectLibraryQuery } from "@/application/queries/project-library-query";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import { createStage10ScaleProjectFixture } from "../../../tests/fixtures/stage10/scale-project";

describe("Stage 10 representative scale", () => {
  it("builds and projects the 50-page / 500-layer / 100-asset target without flattening the model", async () => {
    const fixture = await createStage10ScaleProjectFixture(new WebCryptoSha256Hasher());
    const layerCount = Object.values(fixture.snapshot.project.guide.pages).reduce(
      (total, page) => total + page.extras.length,
      0,
    );

    expect(fixture.snapshot.project.guide.pageOrder).toHaveLength(fixture.expected.pages);
    expect(layerCount).toBe(fixture.expected.layers);
    expect(fixture.snapshot.assets).toHaveLength(fixture.expected.assets);

    const repository: ProjectRepository = {
      save: async () => {},
      get: async () => fixture.snapshot,
      listMetadata: async () => [
        { id: fixture.snapshot.project.id, metadata: fixture.snapshot.project.metadata },
      ],
      delete: async () => {},
    };

    const view = await new GuideStudioQuery(repository).execute(fixture.snapshot.project.id);
    expect(Object.keys(view?.pageViews ?? {})).toHaveLength(fixture.expected.pages);
  });

  it("keeps the project library on metadata-only reads", async () => {
    const fixture = await createStage10ScaleProjectFixture(new WebCryptoSha256Hasher());
    let fullSnapshotReads = 0;

    const repository: ProjectRepository = {
      save: async () => {},
      get: async () => {
        fullSnapshotReads += 1;
        return fixture.snapshot;
      },
      listMetadata: async () => [
        { id: fixture.snapshot.project.id, metadata: fixture.snapshot.project.metadata },
      ],
      delete: async () => {},
    };
    const drafts: SetupDraftRepository = {
      save: async () => {},
      get: async () => undefined,
      list: async () => [],
      delete: async () => {},
    };

    const items = await new ProjectLibraryQuery(repository, drafts).execute();

    expect(items).toHaveLength(1);
    expect(fullSnapshotReads).toBe(0);
  });
});
