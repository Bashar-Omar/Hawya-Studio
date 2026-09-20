import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FULL_PAGE_CATALOG } from "@/domain/guide/page-catalog";
import { compatibleTemplates, resolveDefaultTemplate } from "@/domain/templates/template-engine";

interface GoldenSample {
  localeMode: "en" | "ar" | "bilingual";
  pageType: "cover";
  families?: string[];
  arrangements?: string[];
}

function readGolden(name: "en" | "ar" | "bilingual"): GoldenSample {
  const path = fileURLToPath(
    new URL(`../../../tests/golden/stage05/${name}.json`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, "utf8")) as GoldenSample;
}

describe("Stage 05 built-in template catalog", () => {
  it("keeps the full semantic page catalog from the product specification", () => {
    expect(FULL_PAGE_CATALOG).toHaveLength(65);
    expect(FULL_PAGE_CATALOG.map((entry) => entry.type)).toContain("motion-guidance");
    expect(FULL_PAGE_CATALOG.map((entry) => entry.type)).toContain("custom-application");
    expect(FULL_PAGE_CATALOG.map((entry) => entry.type)).toContain("brand-audit-summary");
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

  it("rebinds semantic slot roles when changing visual family", () => {
    const essential = resolveDefaultTemplate("color-palette", "essential", "en");
    const editorial = resolveDefaultTemplate("color-palette", "editorial", "en");
    expect(essential.template.id).not.toBe(editorial.template.id);
    expect(Object.values(essential.slotBindings).sort()).toEqual(
      Object.values(editorial.slotBindings).sort(),
    );
  });
});
