import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  expect,
  test,
  type BrowserContext,
  type Download,
  type Page,
} from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";


async function createExportReadyProject(page: Page): Promise<void> {
  await page.goto("/studio/new");
  await page.getByLabel("Project name").fill("Stage Eight Identity");
  await page.locator("label.checkbox-row").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
  await page.locator(".color-input-row .text-input").fill("#112233");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Typography" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Guide" })).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();

  await page.getByRole("button", { name: "Open Brand System" }).click();

  await page.getByRole("tab", { name: "Logos" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "stage-eight-logo.svg",
    mimeType: "image/svg+xml",
    buffer: safeSvg(),
  });
  await page.getByRole("button", { name: "Add variant" }).click();
  await expect(page.getByText("Primary", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Typography" }).click();
  await page
    .getByLabel("License / rights note")
    .fill("OFL fixture from installed Fontsource dependency");
  await page.locator('input[type="file"]').setInputFiles(arabicFontPath());
  await expect(page.locator(".font-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Add text style" }).click();
  await expect(page.locator(".type-style-card")).toHaveCount(1);

  await page.getByRole("button", { name: "Guide shell" }).click();
  await page.getByLabel("Profile").selectOption("minimal");
  await page.getByLabel("Document locale mode").selectOption("bilingual");
  await page.getByRole("button", { name: "Generate guide" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your brand guide is generated from reusable semantic content.",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("heading", { name: "Export Center" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

let sharedContext: BrowserContext;
let page: Page;
let exportUrl = "";
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
  await createExportReadyProject(page);
  exportUrl = page.url();
});

test.beforeEach(async () => {
  await page.goto(exportUrl);
  await expect(page.getByRole("heading", { name: "Export Center" })).toBeVisible();
});

test.afterAll(async () => {
  await sharedContext.close();
});

test("Stage 08 exports stable machine-readable brand tokens", async () => {

  await page.getByRole("button", { name: /Design Tokens JSON/ }).click();
  await acknowledgeWarningsIfPresent(page);
  const generate = page.getByRole("button", { name: "Generate & download" });
  await expect(generate).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    generate.click(),
  ]);
  expect(download.suggestedFilename()).toBe("tokens.json");
  const tokenJson = JSON.parse((await downloadedBytes(download)).toString("utf8")) as {
    format?: string;
    locales?: { enabled?: string[] };
    assets?: unknown[];
  };
  expect(tokenJson.format).toBe("hawya-brand-tokens");
  expect(tokenJson.locales?.enabled).toEqual(["en", "ar"]);
  expect(tokenJson.assets?.length).toBeGreaterThan(0);
  expect(runtimeIssues).toEqual([]);
});

test("Stage 08 builds the selected delivery ZIP without silently packaging fonts", async () => {

  await page.getByRole("button", { name: /Delivery ZIP/ }).click();
  await page
    .getByText("Editable + outlined page artwork", { exact: true })
    .locator("..")
    .getByRole("checkbox")
    .uncheck();
  await page
    .getByText("Omit font binaries", { exact: true })
    .locator("..")
    .getByRole("radio")
    .check();
  await acknowledgeWarningsIfPresent(page);
  const generate = page.getByRole("button", { name: "Generate & download" });
  await expect(generate).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    generate.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-delivery\.zip$/);

  const entries = unzipSync(new Uint8Array(await downloadedBytes(download)));
  expect(Object.keys(entries)).toContain("manifest.json");
  expect(Object.keys(entries)).toContain("Guidelines/Brand-Guidelines.md");
  expect(Object.keys(entries).some((path) => path.startsWith("Artwork/"))).toBe(false);
  expect(Object.keys(entries).some((path) => path.startsWith("Fonts/"))).toBe(false);

  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) throw new Error("Delivery manifest missing");
  const manifest = JSON.parse(strFromU8(manifestBytes)) as {
    format?: string;
    fontPolicy?: string;
    exportedAt?: string;
    hawyaVersion?: string;
    include?: { artwork?: boolean };
  };
  expect(manifest.format).toBe("hawya-delivery");
  expect(manifest.fontPolicy).toBe("omit");
  expect(manifest.exportedAt).toMatch(/^\\d{4}-\\d{2}-\\d{2}T/);
  expect(manifest.hawyaVersion).toBe("0.1.0");
  expect(manifest.include?.artwork).toBe(false);
  expect(runtimeIssues).toEqual([]);
});

test("Stage 08 outlines a selected page with the real browser font worker", async () => {

  await page.getByRole("button", { name: /Outlined SVG/ }).click();
  const allPages = page.getByText("All guide pages", { exact: true }).locator("..");
  await allPages.getByRole("checkbox").uncheck();
  const pageChoices = page.locator(".export-pages__grid input[type='checkbox']");
  await pageChoices.first().check();
  await acknowledgeWarningsIfPresent(page);

  const generate = page.getByRole("button", { name: "Generate & download" });
  await expect(generate).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    generate.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-outlined\.svg$/);
  const svg = (await downloadedBytes(download)).toString("utf8");
  expect(svg).toContain('data-hawya-export="outlined"');
  expect(svg).toContain("<path");
  expect(svg).not.toMatch(/<script\b/i);
  expect(runtimeIssues).toEqual([]);
});

test("Stage 08 print view becomes resource-ready without application chrome", async () => {

  await page.getByRole("button", { name: /Browser Print \/ PDF/ }).click();
  await acknowledgeWarningsIfPresent(page);
  const openPrint = page.getByRole("button", { name: "Open Print View" });
  await expect(openPrint).toBeEnabled();
  await openPrint.click();

  await expect(page.locator(".hawya-print-view")).toHaveAttribute("data-print-ready", "true", {
    timeout: 10_000,
  });
  await expect(page.locator(".hawya-print-sheet")).not.toHaveCount(0);
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeEnabled();
  expect(runtimeIssues).toEqual([]);
});
