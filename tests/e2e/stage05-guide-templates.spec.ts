import { expect, test, type Page } from "@playwright/test";

async function createBilingualProjectWithColor(page: Page): Promise<void> {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Create project" }).first().click();
  await expect(page).toHaveURL(/\/studio\/new$/);
  await expect(page.getByLabel("Project name")).toBeVisible();
  await page.getByLabel("Project name").fill("Stage Five Identity");
  await page.locator("label.checkbox-row").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
  const hex = page.locator(".color-input-row .text-input");
  await hex.fill("#112233");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Typography" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Foundation" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Guide" })).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(
    page.getByRole("heading", { name: "Setup complete. The guide shell is ready." }),
  ).toBeVisible();
}

test("guide templates switch without losing semantic content and live tokens update", async ({
  page,
}) => {
  await createBilingualProjectWithColor(page);

  await page.getByLabel("Document locale mode").selectOption("bilingual");
  await page.getByRole("button", { name: "Generate guide" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your brand guide is generated from reusable semantic content.",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Color Palette", exact: false }).click();
  const canvas = page.locator(".guide-canvas");
  await expect(canvas).toContainText("#112233");
  await expect(canvas).toHaveAttribute("data-locale-mode", "bilingual");

  await page.getByLabel("Page template").selectOption("editorial.color-palette.bilingual-mirrored");
  await expect(canvas).toHaveAttribute("data-family", "editorial");
  await expect(canvas).toContainText("#112233");

  await page.getByRole("button", { name: "Open Brand System" }).click();
  await page.getByRole("tab", { name: "Colors" }).click();
  const token = page.locator("article.color-token-card").first();
  await token.getByLabel("HEX").fill("#445566");
  await token.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Guide shell" }).click();
  await page.getByRole("button", { name: "Color Palette", exact: false }).click();
  await expect(page.locator(".guide-canvas")).toContainText("#445566");
});

test("custom generation intentionally surfaces missing semantic slots", async ({ page }) => {
  await createBilingualProjectWithColor(page);
  await page.getByLabel("Profile").selectOption("custom");
  const clearSpaceChoice = page.locator(".guide-page-choice").filter({ hasText: "Clear Space" });
  await clearSpaceChoice.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Generate guide" }).click();
  await page.getByRole("button", { name: "Clear Space", exact: false }).click();
  await expect(page.locator(".guide-canvas")).toContainText("Needs input");
  await expect(page.locator(".guide-page-link.is-active")).toContainText("Needs input");
});
