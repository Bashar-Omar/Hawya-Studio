import { describe, expect, it } from "vitest";

import { arMessages } from "@/i18n/messages/ar";
import { enMessages } from "@/i18n/messages/en";
import { directionForLocale, translate } from "@/i18n/translate";

describe("i18n catalogs", () => {
  it("keeps Arabic and English catalogs structurally identical", () => {
    expect(Object.keys(arMessages).sort()).toEqual(Object.keys(enMessages).sort());
  });

  it("maps locale to UI direction without touching document state", () => {
    expect(directionForLocale("en")).toBe("ltr");
    expect(directionForLocale("ar")).toBe("rtl");
  });

  it("interpolates semantic messages without fragment concatenation", () => {
    expect(translate("en", "theme.changed", { theme: "Dark" })).toBe("Appearance changed to Dark.");
    expect(translate("ar", "language.changed", { language: "العربية" })).toContain("العربية");
  });
});
