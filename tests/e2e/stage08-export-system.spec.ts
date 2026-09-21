import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Download, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

function captureRuntimeIssues(page: Page): string[] {
  const issues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      issues.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  return issues;
}

function safeSvg(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect x="10" y="10" width="100" height="60" rx="12" fill="#112233"/><circle cx="60" cy="40" r="16" fill="#F2C14E"/></svg>',
  );
}

function arabicFontPath(): string {
  const entry = fileURLToPath(
    import.meta.resolve("@fontsource-variable/noto-sans-arabic/index.css"),
  );
  const filesDirectory = join(dirname(entry), "files");
  const candidate = readdirSync(filesDirectory).find(
    (name) => name.endsWith(".woff2") && name.includes("arabic") && name.includes("wght"),
  );
  if (!candidate) throw new Error("Arabic WOFF2 fixture was not found");
  return join(filesDirectory, candidate);
}

async function downloadedBytes(download: Download): Promise<Buffer> {
  const path = await download.path();
  if (!path) throw new Error("Playwright download path is unavailable");
  return readFile(path);
}

async function acknowledgeWarningsIfPresent(page: Page): Promise<void> {
  const acknowledgement = page.getByText("I reviewed these warnings and want to continue.");
  if (await acknowledgement.isVisible().catch(() => false)) {
    await acknowledgement.locator("..").getByRole("checkbox").check();
  }
}

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

test("Stage 08 exports stable machine-readable brand tokens", async ({ page }) => {
  const runtimeIssues = captureRuntimeIssues(page);
  await createExportReadyProject(page);

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

test("Stage 08 builds the selected delivery ZIP without silently packaging fonts", async ({
  page,
}) => {
  const runtimeIssues = captureRuntimeIssues(page);
  await createExportReadyProject(page);

  await page.getByRole("button", { name: /Delivery ZIP/ }).click();
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
  expect(Object.keys(entries).some((path) => path.startsWith("Artwork/Outlined/"))).toBe(true);
  expect(Object.keys(entries).some((path) => path.startsWith("Fonts/"))).toBe(false);

  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) throw new Error("Delivery manifest missing");
  const manifest = JSON.parse(strFromU8(manifestBytes)) as {
    format?: string;
    fontPolicy?: string;
  };
  expect(manifest.format).toBe("hawya-delivery");
  expect(manifest.fontPolicy).toBe("omit");
  expect(runtimeIssues).toEqual([]);
});

test("Stage 08 print view becomes resource-ready without application chrome", async ({ page }) => {
  const runtimeIssues = captureRuntimeIssues(page);
  await createExportReadyProject(page);

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
