import { describe, expect, it } from "vitest";

import { matchRoute } from "@/app/routes/route-config";

describe("app route matching", () => {
  it("normalizes trailing slashes without hiding unknown routes", () => {
    expect(matchRoute("/")).toBe("landing");
    expect(matchRoute("/studio/")).toBe("studio");
    expect(matchRoute("/settings")).toBe("settings");
    expect(matchRoute("/missing")).toBe("not-found");
  });
});
