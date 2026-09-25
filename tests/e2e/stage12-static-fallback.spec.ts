import { expect, test } from "@playwright/test";

test("Stage 12 serves the PWA from a repository subpath with hash routing and offline shell", async ({
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

  await page.goto("./#/studio");
  await expect(page.getByRole("button", { name: "Create project" }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/Hawya-Studio\/#\/studio$/);

  const manifestEvidence = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) throw new Error("Missing manifest link");
    const response = await fetch(link.href);
    const manifest = await response.json();
    return {
      linkPath: new URL(link.href).pathname,
      startUrl: manifest.start_url,
      scope: manifest.scope,
      iconPaths: (manifest.icons ?? []).map((icon: { src?: string }) => icon.src),
    };
  });
  expect(manifestEvidence).toEqual({
    linkPath: "/Hawya-Studio/manifest.webmanifest",
    startUrl: "/Hawya-Studio/",
    scope: "/Hawya-Studio/",
    iconPaths: ["/Hawya-Studio/icons/hawya-192.png", "/Hawya-Studio/icons/hawya-512.png"],
  });

  const workerEvidence = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await new Promise<void>((resolveReady) => {
      if (navigator.serviceWorker.controller) {
        resolveReady();
        return;
      }
      navigator.serviceWorker.addEventListener("controllerchange", () => resolveReady(), {
        once: true,
      });
    });
    return {
      scopePath: new URL(registration.scope).pathname,
      scriptPath: registration.active ? new URL(registration.active.scriptURL).pathname : null,
    };
  });
  expect(workerEvidence).toEqual({
    scopePath: "/Hawya-Studio/",
    scriptPath: "/Hawya-Studio/sw.js",
  });

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/Hawya-Studio\/#\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

  const cachedPaths = await page.evaluate(async () => {
    const requests = (
      await Promise.all(
        (await caches.keys()).map(async (key) => {
          const cache = await caches.open(key);
          return cache.keys();
        }),
      )
    ).flat();
    return requests.map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths.length).toBeGreaterThan(0);
  expect(cachedPaths.every((pathname) => pathname.startsWith("/Hawya-Studio/"))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(/\/Hawya-Studio\/#\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  expect(runtimeIssues).toEqual([]);

  await context.close();
});
