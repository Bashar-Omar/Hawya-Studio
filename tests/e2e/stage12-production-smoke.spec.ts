import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = resolve("production-smoke-evidence");

test("Stage 12 anonymous production journey works online and offline", async ({ browser }) => {
  test.setTimeout(120_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  const runtimeIssues: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      runtimeIssues.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => runtimeIssues.push(`pageerror: ${error.message}`));

  const routeStatuses: Record<string, number | null> = {};
  for (const path of ["/", "/studio", "/settings", "/about", "/studio/new"]) {
    const response = await page.goto(path, { waitUntil: "networkidle" });
    routeStatuses[path] = response?.status() ?? null;
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Hawya Studio");
  }

  await page.goto("/studio");
  await expect(page.getByRole("button", { name: "Create project" }).first()).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) throw new Error("Missing manifest link");
    const response = await fetch(link.href);
    return response.json();
  });
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");

  const serviceWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      scope: registration.scope,
      activeScript: registration.active?.scriptURL ?? null,
    };
  });
  const origin = new URL(page.url()).origin;
  expect(serviceWorker.scope).toBe(`${origin}/`);
  expect(serviceWorker.activeScript).toBe(`${origin}/sw.js`);

  await page.getByRole("button", { name: "Create project" }).first().click();
  await page.getByLabel("Project name").fill("Production Smoke Identity");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Logo" })).toBeVisible();

  for (const heading of ["Colors", "Typography", "Foundation", "Guide"]) {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(
    page.getByRole("heading", { name: "Setup complete. The guide shell is ready." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open Brand System" }).click();
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();
  const projectUrl = page.url();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(projectUrl);
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();

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
    cacheSnapshot.urls.some((value) => new URL(value).pathname.startsWith("/studio/")),
  ).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(projectUrl);
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();
  await page.screenshot({
    path: join(EVIDENCE_DIR, "production-project-offline.png"),
    fullPage: true,
  });
  await context.setOffline(false);

  const evidence = {
    testedUrl: process.env.HAWYA_PRODUCTION_URL ?? "https://hawya-studio.vercel.app",
    routeStatuses,
    manifest: {
      startUrl: manifest.start_url,
      scope: manifest.scope,
      display: manifest.display,
    },
    serviceWorker,
    projectUrl,
    offlineReload: true,
    cacheKeys: cacheSnapshot.keys,
    runtimeIssues,
  };

  await writeFile(
    join(EVIDENCE_DIR, "production-smoke.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  expect(runtimeIssues).toEqual([]);
  await context.close();
});
