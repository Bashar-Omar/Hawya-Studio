import arGoldenRaw from "../../../tests/golden/stage05/ar.json?raw";
import bilingualGoldenRaw from "../../../tests/golden/stage05/bilingual.json?raw";
import enGoldenRaw from "../../../tests/golden/stage05/en.json?raw";
import stressGoldenRaw from "../../../tests/golden/stage05/stress.json?raw";

import { describe, expect, it } from "vitest";

import { createSemanticPageContent } from "@/domain/guide/page-content";
import { FULL_PAGE_CATALOG } from "@/domain/guide/page-catalog";
import { compatibleTemplates, resolveDefaultTemplate } from "@/domain/templates/template-engine";

interface GoldenSample {
  localeMode: "en" | "ar" | "bilingual";
  pageType: "cover";
  families?: string[];
  arrangements?: string[];
}

function readGolden(name: "en" | "ar" | "bilingual"): GoldenSample {
  const raw = name === "en" ? enGoldenRaw : name === "ar" ? arGoldenRaw : bilingualGoldenRaw;
  return JSON.parse(raw) as GoldenSample;
}

describe("Stage 05 built-in template catalog", () => {
  it("keeps the full semantic page catalog from the product specification", () => {
    expect(FULL_PAGE_CATALOG).toHaveLength(65);
    expect(FULL_PAGE_CATALOG.map((entry) => entry.type)).toContain("motion-guidance");
    expect(FULL_PAGE_CATALOG.map((entry) => entry.type)).toContain("custom-application");
    expect(FULL_PAGE_CATALOG.map((entry) => entry.type)).toContain("brand-audit-summary");
  });

  it("can create semantic PageContent for every stable catalog page type", () => {
    expect(FULL_PAGE_CATALOG).toHaveLength(65);
    for (const entry of FULL_PAGE_CATALOG) {
      const content = createSemanticPageContent(entry.type);
      expect(content.schema).toBe("hawya.page-content.v1");
      expect(content.semanticType).toBe(entry.type);
      expect(content.title.en ?? content.title.ar).toBeTruthy();
    }
  });

  it("matches English, Arabic and bilingual golden template samples", () => {
    for (const name of ["en", "ar", "bilingual"] as const) {
      const golden = readGolden(name);
      const templates = compatibleTemplates(golden.pageType, golden.localeMode);
      if (golden.families) {
        expect(templates.map((template) => template.familyId)).toEqual(golden.families);
      }
      if (golden.arrangements) {
        expect(templates.map((template) => template.bilingualArrangement)).toEqual(
          golden.arrangements,
        );
      }
    }
  });

  it("keeps long bilingual golden content inside valid declarative template bounds", () => {
    const stress = JSON.parse(stressGoldenRaw) as {
      localeMode: "bilingual";
      pageType: "cover";
      title: { en: string; ar: string };
    };
    expect(stress.title.en.length).toBeGreaterThan(180);
    expect(stress.title.ar.length).toBeGreaterThan(180);
    const templates = compatibleTemplates(stress.pageType, stress.localeMode);
    expect(templates).not.toHaveLength(0);
    for (const template of templates) {
      for (const slot of template.slots) {
        expect(slot.rect.x + slot.rect.width).toBeLessThanOrEqual(100);
        expect(slot.rect.y + slot.rect.height).toBeLessThanOrEqual(100);
      }
    }
  });

  it("rebinds semantic slot roles when changing visual family", () => {
    const essential = resolveDefaultTemplate("color-palette", "essential", "en");
    const editorial = resolveDefaultTemplate("color-palette", "editorial", "en");
    expect(essential.template.id).not.toBe(editorial.template.id);
    expect(Object.values(essential.slotBindings).sort()).toEqual(
      Object.values(editorial.slotBindings).sort(),
    );
  });
});
