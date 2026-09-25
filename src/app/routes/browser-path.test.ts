import { describe, expect, it } from "vitest";

import {
  appPathFromBrowserLocation,
  browserPathForAppPath,
  normalizeAppBasePath,
  usesHashRouting,
} from "@/app/routes/browser-path";

describe("browser path adapter", () => {
  it("preserves history paths for a root-hosted build", () => {
    expect(normalizeAppBasePath("/")).toBe("/");
    expect(usesHashRouting("/")).toBe(false);
    expect(browserPathForAppPath("/studio", "/")).toBe("/studio");
    expect(appPathFromBrowserLocation({ pathname: "/studio", hash: "" }, "/")).toBe("/studio");
  });

  it("maps application routes to a hash under a static-host subpath", () => {
    expect(normalizeAppBasePath("/Hawya-Studio")).toBe("/Hawya-Studio/");
    expect(usesHashRouting("/Hawya-Studio/")).toBe(true);
    expect(browserPathForAppPath("/", "/Hawya-Studio/")).toBe("/Hawya-Studio/#/");
    expect(browserPathForAppPath("/studio", "/Hawya-Studio/")).toBe("/Hawya-Studio/#/studio");
    expect(
      appPathFromBrowserLocation(
        { pathname: "/Hawya-Studio/", hash: "#/studio/projects/example" },
        "/Hawya-Studio/",
      ),
    ).toBe("/studio/projects/example");
  });

  it("falls back to the app root when a subpath build has no route hash", () => {
    expect(
      appPathFromBrowserLocation({ pathname: "/Hawya-Studio/", hash: "" }, "/Hawya-Studio/"),
    ).toBe("/");
    expect(() => browserPathForAppPath("studio", "/Hawya-Studio/")).toThrow(/must be absolute/i);
  });
});
