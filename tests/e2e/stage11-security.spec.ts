import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

async function finishProject(page: Page, name: string): Promise<void> {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Create project" }).first().click();
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  for (const heading of ["Colors", "Typography", "Foundation", "Guide"]) {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.getByRole("button", { name: "Open Brand System" }).click();
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();
}

test("Stage 11 strips namespace, data URL and executable SVG payloads without executing them", async ({
  page,
}) => {
  await finishProject(page, "Adversarial SVG");
  const payload = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      onload="window.__hawyaStage11Pwned=1">
      <a href="javascript:window.__hawyaStage11Pwned=2"><rect width="10" height="10"/></a>
      <image xlink:href="data:image/svg+xml,%3Csvg%20onload='window.__hawyaStage11Pwned=3'/%3E"/>
      <rect width="20" height="20" style="fill:url(data:image/svg+xml,evil)" />
      <animate attributeName="x" from="0" to="10" dur="1s"/>
    </svg>`,
  );

  await page.locator('input[type="file"]').setInputFiles({
    name: "stage11-adversarial.svg",
    mimeType: "image/svg+xml",
    buffer: payload,
  });

  const card = page.locator("article.asset-card").filter({ hasText: "stage11-adversarial" });
  await expect(card).toContainText("SVG sanitized");
  await expect(card).toContainText(/event-handler|javascript-url|external-reference|inline-style/);
  expect(
    await page.evaluate(
      () => (window as Window & { __hawyaStage11Pwned?: number }).__hawyaStage11Pwned,
    ),
  ).toBeUndefined();
});

test("Stage 11 rejects malformed raster and font payloads after magic-byte admission", async ({
  page,
}) => {
  await finishProject(page, "Malformed Binary QA");

  await page.getByRole("tab", { name: "Assets" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("article.asset-card").filter({ hasText: "broken" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Typography" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.woff2",
    mimeType: "font/woff2",
    buffer: Buffer.from("wOF2definitely-not-a-font"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".font-card")).toHaveCount(0);
});

test("Stage 11 rejects a path-traversal .hawya before creating any local project", async ({
  page,
}) => {
  await page.goto("/studio");
  const malicious = zipSync({
    "../manifest.json": strToU8("{}"),
    "project.json": strToU8("{}"),
    "checksums.json": strToU8("{}"),
  });

  await page.locator('input[type="file"][accept*=".hawya"]').first().setInputFiles({
    name: "traversal.hawya",
    mimeType: "application/zip",
    buffer: Buffer.from(malicious),
  });

  await expect(page.locator(".error-banner")).toContainText(/unsafe|path|archive/i);
  await expect(page.locator(".project-card")).toHaveCount(0);
});
