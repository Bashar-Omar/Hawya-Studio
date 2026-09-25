import { expect, test, type Page } from "@playwright/test";

async function createLocalProject(page: Page): Promise<void> {
  await page.getByLabel("Project name").fill("Offline Identity");
  await page.getByRole("button", { name: "Continue" }).click();
  for (const heading of ["Colors", "Typography", "Foundation", "Guide"]) {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.getByRole("button", { name: "Open Brand System" }).click();
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();
}

test("Stage 10 installs an offline shell without caching project routes or user data", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  const runtimeIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      runtimeIssues.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => runtimeIssues.push(`pageerror: ${error.message}`));

  await page.goto("/studio/new");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await createLocalProject(page);

  const cacheSnapshot = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = (
      await Promise.all(
        keys.map(async (key) => {
          const cache = await caches.open(key);
          return (await cache.keys()).map((request) => request.url);
        }),
      )
    ).flat();
    return { keys, urls };
  });

  expect(cacheSnapshot.keys.length).toBeGreaterThan(0);
  expect(cacheSnapshot.keys.every((key) => key.startsWith("hawya-shell-"))).toBe(true);
  expect(
    cacheSnapshot.urls.every((value) => {
      const pathname = new URL(value).pathname;
      return (
        pathname === "/" ||
        pathname === "/index.html" ||
        pathname === "/manifest.webmanifest" ||
        pathname.startsWith("/icons/") ||
        pathname.startsWith("/assets/")
      );
    }),
  ).toBe(true);
  expect(cacheSnapshot.urls.some((value) => new URL(value).pathname.startsWith("/studio/"))).toBe(
    false,
  );

  const loadedBuildAssets = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((value) => new URL(value).pathname.startsWith("/assets/")),
  );
  const cacheCoverage = await page.evaluate(async (urls) => {
    const checks = await Promise.all(
      urls.map(async (url) => ({
        url,
        cached: Boolean(await caches.match(url, { ignoreSearch: true, ignoreVary: true })),
      })),
    );
    return checks;
  }, loadedBuildAssets);
  expect(cacheCoverage.filter((entry) => !entry.cached)).toEqual([]);

  const projectUrl = page.url();
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(projectUrl);
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();
  expect(runtimeIssues).toEqual([]);

  await context.close();
});

test("Stage 10 exposes an installable Chromium-compatible manifest", async ({ page }) => {
  await page.goto("/");

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) throw new Error("Missing manifest link");
    const response = await fetch(link.href);
    return response.json();
  });

  expect(manifest.name || manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(["standalone", "fullscreen", "minimal-ui"]).toContain(manifest.display);
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", type: "image/png" }),
    ]),
  );
});
