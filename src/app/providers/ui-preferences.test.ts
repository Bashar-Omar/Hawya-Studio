import { describe, expect, it } from "vitest";

import { resolveTheme } from "@/app/providers/ui-preferences";

describe("theme resolution", () => {
  it("keeps explicit themes and resolves system theme", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
    expect(resolveTheme("system", "dark")).toBe("dark");
  });
});
