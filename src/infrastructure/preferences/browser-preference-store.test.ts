import { describe, expect, it } from "vitest";

import { readUiPreferences } from "@/infrastructure/preferences/browser-preference-store";

function storageWith(values: Record<string, string>): Pick<Storage, "getItem"> {
  return {
    getItem(key) {
      return values[key] ?? null;
    },
  };
}

describe("browser preference store", () => {
  it("accepts only supported bootstrap preferences", () => {
    expect(
      readUiPreferences(
        storageWith({
          "hawya.ui.locale": "ar",
          "hawya.ui.theme": "dark",
        }),
      ),
    ).toEqual({ locale: "ar", theme: "dark" });

    expect(
      readUiPreferences(
        storageWith({
          "hawya.ui.locale": "fr",
          "hawya.ui.theme": "neon",
        }),
      ),
    ).toEqual({ locale: "en", theme: "system" });
  });
});
