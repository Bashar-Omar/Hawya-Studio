import { beforeEach, describe, expect, it } from "vitest";

import { GuideStudioQuery } from "@/application/queries/guide-studio-query";
import { GenerateGuideUseCase } from "@/application/use-cases/generate-guide";
import { ManageColorTokensUseCase } from "@/application/use-cases/manage-color-tokens";
import { SwitchGuidePageTemplateUseCase } from "@/application/use-cases/switch-guide-page-template";
import { ColorJsColorEngine } from "@/infrastructure/analysis/color-js-color-engine";
import { DexieProjectRepository } from "@/infrastructure/db/dexie-project-repository";
import { HawyaDatabase } from "@/infrastructure/db/hawya-database";
import { CryptoIdGenerator } from "@/infrastructure/runtime/crypto-id-generator";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_COLOR_ID,
  SYNTHETIC_PROJECT_ID,
} from "../../../tests/fixtures/stage02/synthetic-project";

class TestClock {
  now() {
    return "2026-09-20T12:00:00.000Z";
  }
}

describe("Stage 05 guide generator invariants", () => {
  let database: HawyaDatabase;
  let projects: DexieProjectRepository;
  const clock = new TestClock();
  const ids = new CryptoIdGenerator();

  beforeEach(async () => {
    database = new HawyaDatabase(`stage05-${crypto.randomUUID()}`);
    projects = new DexieProjectRepository(database);
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    await projects.save(fixture.snapshot);
  });

  it("generates semantic pages from available brand data and omits impossible profile pages", async () => {
    const generate = new GenerateGuideUseCase(projects, clock, ids);
    const result = await generate.execute(SYNTHETIC_PROJECT_ID, {
      profile: "standard",
      familyId: "essential",
      localeMode: "bilingual",
    });
    const pageTypes = result.project.guide.pageOrder.map(
      (pageId) => result.project.guide.pages[pageId]?.semanticType,
    );
    expect(pageTypes).toContain("cover");
    expect(pageTypes).toContain("primary-logo");
    expect(pageTypes).toContain("color-palette");
    expect(pageTypes).toContain("type-hierarchy");
    expect(pageTypes).toContain("arabic-latin-pairing");
    expect(pageTypes).not.toContain("logo-clear-space");
    expect(result.project.settings.guideLocaleMode).toBe("bilingual");
    expect(result.project.templatePackRefs).toContainEqual({ id: "builtin-core", version: 1 });
  });

  it("switches compatible templates without mutating semantic PageContent", async () => {
    const generate = new GenerateGuideUseCase(projects, clock, ids);
    const switchTemplate = new SwitchGuidePageTemplateUseCase(projects, clock);
    const generated = await generate.execute(SYNTHETIC_PROJECT_ID, {
      profile: "minimal",
      familyId: "essential",
      localeMode: "en",
    });
    const pageId = generated.project.guide.pageOrder.find(
      (candidate) => generated.project.guide.pages[candidate]?.semanticType === "color-palette",
    );
    expect(pageId).toBeDefined();
    if (!pageId) return;
    const before = generated.project.guide.pages[pageId];
    expect(before).toBeDefined();
    if (!before) return;
    const contentBefore = structuredClone(before.content);
    const extrasBefore = structuredClone(before.extras);
    const overridesBefore = structuredClone(before.localOverrides);

    const switched = await switchTemplate.execute(
      SYNTHETIC_PROJECT_ID,
      pageId,
      "editorial.color-palette.standard",
      "en",
    );
    const after = switched.project.guide.pages[pageId];
    expect(after?.content).toEqual(contentBefore);
    expect(after?.extras).toEqual(extrasBefore);
    expect(after?.localOverrides).toEqual(overridesBefore);
    expect(after?.templateBinding.templateId).toBe("editorial.color-palette.standard");
  });

  it("resolves live color tokens after a Brand System edit without rewriting the guide page", async () => {
    const generate = new GenerateGuideUseCase(projects, clock, ids);
    const query = new GuideStudioQuery(projects);
    const colors = new ManageColorTokensUseCase(projects, new ColorJsColorEngine(), clock, ids);
    const generated = await generate.execute(SYNTHETIC_PROJECT_ID, {
      profile: "minimal",
      familyId: "grid",
      localeMode: "en",
    });
    const pageId = generated.project.guide.pageOrder.find(
      (candidate) => generated.project.guide.pages[candidate]?.semanticType === "color-palette",
    );
    expect(pageId).toBeDefined();
    if (!pageId) return;
    const persistedContent = structuredClone(generated.project.guide.pages[pageId]?.content);

    await colors.update(SYNTHETIC_PROJECT_ID, SYNTHETIC_COLOR_ID, {
      name: { en: "Ink" },
      role: "primary",
      srgbHex: "#224466",
    });
    const view = await query.execute(SYNTHETIC_PROJECT_ID);
    const paletteSlot = view?.pageViews[pageId]?.slots.find(
      (slot) => slot.role === "brand.colors.palette",
    );
    expect(paletteSlot?.value?.kind).toBe("colors");
    if (paletteSlot?.value?.kind === "colors") {
      expect(paletteSlot.value.tokens[0]?.srgbHex).toBe("#224466");
    }
    expect(view?.snapshot.project.guide.pages[pageId]?.content).toEqual(persistedContent);
  });

  it("custom generation keeps explicitly requested missing pages as Needs input", async () => {
    const generate = new GenerateGuideUseCase(projects, clock, ids);
    const query = new GuideStudioQuery(projects);
    const result = await generate.execute(SYNTHETIC_PROJECT_ID, {
      profile: "custom",
      familyId: "essential",
      localeMode: "en",
      customPageTypes: ["cover", "logo-clear-space"],
    });
    const missingPageId = result.project.guide.pageOrder.find(
      (pageId) => result.project.guide.pages[pageId]?.semanticType === "logo-clear-space",
    );
    expect(missingPageId).toBeDefined();
    if (!missingPageId) return;
    const view = await query.execute(SYNTHETIC_PROJECT_ID);
    expect(view?.pageViews[missingPageId]?.status).toBe("needs-input");
  });
});
