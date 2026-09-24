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
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      runtimeIssues.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => runtimeIssues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });

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

  const projectUrl = page.url();
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(projectUrl);
  const offlineBody = await page.locator("body").innerText();
  console.log("Stage10 offline diagnostics", { offlineBody, runtimeIssues, failedRequests });
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();
  expect(runtimeIssues).toEqual([]);

  await context.close();
});
