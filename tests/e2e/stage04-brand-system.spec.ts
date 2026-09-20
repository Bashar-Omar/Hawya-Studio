import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

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
  await expect(
    page.getByRole("heading", { name: "Setup complete. The guide shell is ready." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open Brand System" }).click();
  await expect(page.getByText("Brand System", { exact: true })).toBeVisible();
}

function safeSvg(label: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>${label}</title><rect width="100" height="100" fill="#5B4FF7"/></svg>`,
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
  if (!candidate)
    throw new Error(
      "Noto Sans Arabic WOFF2 fixture was not found in the installed Fontsource package",
    );
  return join(filesDirectory, candidate);
}

test("malicious SVG is sanitized before it becomes a project asset", async ({ page }) => {
  await finishProject(page, "Secure Identity");
  const malicious = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__hawyaPwned=1"><script>window.__hawyaPwned=1</script><style>.remote{fill:url(https://example.com/paint.svg#x)}</style><foreignObject><div>bad</div></foreignObject><image href="https://example.com/tracker.png"/><rect class="remote" width="10" height="10" filter="url(https://example.com/filter.svg#x)" fill="#111"/></svg>',
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "malicious.svg",
    mimeType: "image/svg+xml",
    buffer: malicious,
  });
  const card = page.locator("article.asset-card").filter({ hasText: "malicious" });
  await expect(card).toContainText("SVG sanitized");
  await expect(card).toContainText(/script|style|foreignObject|event-handler|external-reference/);
  await expect(card).toContainText("external-css-url");
  expect(
    await page.evaluate(() => (window as Window & { __hawyaPwned?: number }).__hawyaPwned),
  ).toBeUndefined();
});

test("replacing a logo asset preserves the semantic logo reference", async ({ page }) => {
  await finishProject(page, "Stable References");
  await page.getByRole("tab", { name: "Logos" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "primary.svg",
    mimeType: "image/svg+xml",
    buffer: safeSvg("primary"),
  });
  await page.getByRole("button", { name: "Add variant" }).click();
  await expect(page.getByText("Primary", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Assets" }).click();
  const card = page.locator("article.asset-card").filter({ hasText: "primary" });
  await expect(card).toContainText("Used 1 time(s)");
  await card.locator('input[type="file"]').setInputFiles({
    name: "primary-replacement.svg",
    mimeType: "image/svg+xml",
    buffer: safeSvg("replacement"),
  });
  await expect(card).toContainText("primary-replacement.svg");

  await page.getByRole("tab", { name: "Logos" }).click();
  await expect(page.getByText("Primary", { exact: true })).toBeVisible();
});

test("an uploaded Arabic font is analyzed, registered and rendered locally", async ({ page }) => {
  await finishProject(page, "Arabic Typography");
  await page.getByRole("tab", { name: "Typography" }).click();
  await page
    .getByLabel("License / rights note")
    .fill("OFL fixture from installed Fontsource dependency");
  await page.locator('input[type="file"]').setInputFiles(arabicFontPath());

  const sample = page.locator(".font-sample").first();
  await expect(sample).toContainText("الهوية تبدأ من التفاصيل");
  await expect(page.locator(".font-card").first()).toContainText(/Arabic \d+%/);
  const family = await sample.getAttribute("data-font-family");
  expect(family).toBeTruthy();
  const registered = await page.evaluate(
    (fontFamily) => document.fonts.check(`16px "${fontFamily}"`, "الهوية"),
    family,
  );
  expect(registered).toBe(true);
});
