import { readFile } from "node:fs/promises";

import { expect, test, type BrowserContext, type Download, type Page } from "@playwright/test";

const ARTWORK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAYAAACbU/80AAAAMUlEQVR4nO3OQQEAMAjEsGMaJmJy8G9myOCTGmjqvv5Z7GzOAQAAAAAAAAAAAACSZADTLQG71M5GPwAAAABJRU5ErkJggg==",
  "base64",
);
const BACKGROUND_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAYAAACbU/80AAAAMElEQVR4nO3OQREAMAgEsaOS6n+qCQdFBp+sgU31uz+Lnc05AAAAAAAAAAAAAECSDOJPAw+ZZAJ0AAAAAElFTkSuQmCC",
  "base64",
);

async function finishProject(page: Page): Promise<void> {
  await page.goto("/studio/new");
  await page.getByLabel("Project name").fill("Stage Nine Mockups");
  await page.getByRole("button", { name: "Continue" }).click();
  for (const heading of ["Colors", "Typography", "Foundation", "Guide"]) {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.getByRole("button", { name: "Open Brand System" }).click();
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Assets" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "mockup-artwork.png",
    mimeType: "image/png",
    buffer: ARTWORK_PNG,
  });
  await expect(page.locator("article.asset-card").filter({ hasText: "mockup-artwork" })).toBeVisible();

  await page.getByRole("button", { name: "Guide shell" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your brand guide is generated from reusable semantic content.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mockups" }).click();
  await expect(page.getByRole("heading", { name: "Mockup Studio" })).toBeVisible();
}

async function downloadedBytes(download: Download): Promise<Buffer> {
  const path = await download.path();
  if (!path) throw new Error("Playwright download path is unavailable");
  return readFile(path);
}

test.describe.configure({ mode: "serial" });

let sharedContext: BrowserContext;
let page: Page;
const runtimeIssues: string[] = [];

test.beforeAll(async ({ browser }) => {
  sharedContext = await browser.newContext();
  page = await sharedContext.newPage();
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      runtimeIssues.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => runtimeIssues.push(`pageerror: ${error.message}`));
  await finishProject(page);
});

test.afterAll(async () => {
  await sharedContext.close();
});

test("Stage 09 persists a reusable smart mockup and physical corner geometry", async () => {
  await page.locator('input[type="file"][accept=".png,.jpg,.jpeg,.webp"]').setInputFiles({
    name: "desk-scene.png",
    mimeType: "image/png",
    buffer: BACKGROUND_PNG,
  });
  await expect(page.getByLabel("Preset name")).toHaveValue("desk-scene");

  await page.getByLabel("Crop X %").fill("10");
  await page.getByLabel("Crop Y %").fill("10");
  await page.getByLabel("Crop width %").fill("80");
  await page.getByLabel("Crop height %").fill("80");

  const smartGroup = page.getByRole("group", { name: "Smart planar surface" });
  const smartToggle = smartGroup.getByRole("checkbox");
  await expect(smartToggle).toBeEnabled();
  await smartToggle.check();

  const topLeft = page.getByRole("group", { name: "Top-left corner" });
  await topLeft.getByLabel("X %").fill("25");
  await topLeft.getByLabel("Y %").fill("22");
  await page.getByLabel("Blend mode").selectOption("multiply");
  await page.getByLabel("Artwork opacity").fill("90");

  await page.getByRole("button", { name: "Save preset" }).click();
  await expect(page.locator(".mockup-preset-link.is-active")).toContainText("Smart surface");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Mockup Studio" })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Smart planar surface" }).getByRole("checkbox"),
  ).toBeChecked();
  await expect(page.getByRole("group", { name: "Top-left corner" }).getByLabel("X %")).toHaveValue(
    "25",
  );

  const firstCorner = page.locator(".mockup-corner").first();
  const physicalLeft = await firstCorner.evaluate((element) => (element as HTMLElement).style.left);
  expect(physicalLeft).toBe("25%");
  expect(runtimeIssues).toEqual([]);
});

test("Stage 09 renders/downloads PNG and RTL does not mirror mockup coordinates", async () => {
  const firstCorner = page.locator(".mockup-corner").first();
  const physicalLeftBefore = await firstCorner.evaluate((element) => (element as HTMLElement).style.left);
  expect(physicalLeftBefore).toBe("25%");

  const previewButton = page.getByRole("button", { name: "Render preview" });
  await expect(previewButton).toBeEnabled();
  await previewButton.click();
  await expect(page.getByText(/Renderer: (webgl|canvas)/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByAltText("Rendered mockup preview")).toHaveAttribute("src", /^blob:/);

  const downloadButton = page.getByRole("button", { name: "Render & download PNG" });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    downloadButton.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/stage-nine-mockups-desk-scene-mockup\.png$/);
  const png = await downloadedBytes(download);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

  await page.getByRole("button", { name: "Language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const physicalLeftAfter = await firstCorner.evaluate((element) => (element as HTMLElement).style.left);
  expect(physicalLeftAfter).toBe("25%");
  expect(runtimeIssues).toEqual([]);
});
