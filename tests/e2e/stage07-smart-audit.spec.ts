import { expect, test, type Page } from "@playwright/test";

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

async function finishProject(page: Page): Promise<void> {
  await page.goto("/studio/new");
  await page.getByLabel("Project name").fill("Stage Seven Identity");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Typography" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Foundation" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Guide" })).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(
    page.getByRole("heading", { name: "Setup complete. The guide shell is ready." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open Brand System" }).click();
  await expect(page.getByRole("heading", { name: "Stage Seven Identity", level: 1 })).toBeVisible();
}

function measuredSvg(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="40" rx="6" fill="#2456A6"/><circle cx="50" cy="50" r="10" fill="#F2C14E"/></svg>',
  );
}

test("Smart Audit measures logo geometry, requires explicit professional-rule confirmation, applies a typed fix, and remains RTL-safe", async ({
  page,
}) => {
  const runtimeIssues = captureRuntimeIssues(page);
  await finishProject(page);

  await page.getByRole("tab", { name: "Logos" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "measured-logo.svg",
    mimeType: "image/svg+xml",
    buffer: measuredSvg(),
  });
  await page.getByRole("button", { name: "Add variant" }).click();
  await expect(page.locator("article.brand-row-card").getByLabel("Name")).toHaveValue(
    "measured-logo",
  );

  await page.getByRole("tab", { name: "Smart Audit" }).click();
  await expect(page.getByRole("heading", { name: "Smart Audit" })).toBeVisible();
  await expect(page.getByText("Not confirmed")).toHaveCount(2);
  await page.getByRole("button", { name: "Analyze logo" }).click();
  await expect(page.getByTestId("logo-analysis")).toBeVisible();
  await expect(page.getByTestId("crop-suggestion")).toBeVisible();
  await expect(page.getByTestId("clear-space-preview").locator("img")).toBeVisible();
  await expect(page.locator(".audit-palette__item")).toHaveCount(2);
  await expect(page.locator(".audit-dont-example__preview img")).toHaveCount(8);

  const clearRule = page.locator("article.audit-rule-card").filter({ hasText: "Clear-space rule" });
  await clearRule.getByRole("button", { name: "Confirm rule" }).click();
  const minimumRule = page
    .locator("article.audit-rule-card")
    .filter({ hasText: "Minimum-size rule" });
  await minimumRule.getByLabel("Screen minimum (px)").fill("48");
  await expect(page.getByTestId("minimum-size-preview")).toContainText("48px");
  await expect(page.getByTestId("minimum-size-preview").locator("img")).toBeVisible();
  await minimumRule.getByRole("button", { name: "Confirm rule" }).click();
  await expect(page.getByText("Confirmed by user")).toHaveCount(2);

  await page
    .locator(".audit-palette__item")
    .first()
    .getByRole("button", { name: "Add as token" })
    .click();
  await expect(page.locator(".audit-palette__item").first()).toContainText("Token exists");

  await page.getByRole("button", { name: "Guide shell" }).click();
  await page.getByLabel("Profile").selectOption("minimal");
  await page.getByRole("button", { name: "Generate guide" }).click();
  await page.getByRole("button", { name: "Edit page" }).click();
  await page.getByRole("button", { name: "Add rectangle (R)" }).click();
  await page.getByLabel("X").fill("-120");
  await page.getByLabel("X").press("Enter");
  await page.getByRole("button", { name: "Back to guide" }).click();
  await page.getByRole("button", { name: "Open Brand System" }).click();
  await page.getByRole("tab", { name: "Smart Audit" }).click();
  const outsideIssue = page
    .locator("article.audit-issue")
    .filter({ hasText: "Layer extends outside the page" });
  await expect(outsideIssue).toBeVisible();
  await outsideIssue.getByRole("button", { name: "Fit to page" }).click();
  await expect(outsideIssue).toHaveCount(0);

  await page.reload();
  await page.getByRole("tab", { name: "Smart Audit" }).click();
  await expect(page.getByText("Confirmed by user")).toHaveCount(2);
  await expect(page.getByTestId("logo-analysis")).toBeVisible();

  await page.getByRole("button", { name: "Interface language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("tab", { name: "التدقيق الذكي" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "التدقيق الذكي" })).toBeVisible();
  expect(runtimeIssues).toEqual([]);
});
