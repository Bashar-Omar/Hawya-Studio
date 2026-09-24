import { expect, test } from "@playwright/test";

test("Stage 10 honors reduced motion for application chrome", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio");

  const commandTrigger = page.getByRole("button", { name: /Commands/ });
  await expect(commandTrigger).toBeVisible();
  await expect
    .poll(() => commandTrigger.evaluate((element) => getComputedStyle(element).transitionDuration))
    .toBe("0s");

  await commandTrigger.click();
  const dialog = page.locator(".dialog-popup").filter({ has: page.getByRole("textbox") });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => dialog.evaluate((element) => getComputedStyle(element).animationName))
    .toBe("none");
});

test("Stage 10 keeps the skip link keyboard-first and moves focus to main content", async ({ page }) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "Skip to content" });

  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("#main-content")).toBeFocused();
});

test("Stage 10 enlarges compact chrome targets on touch input", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/studio");

  const compact = page.getByRole("button", { name: /Commands/ });
  await expect(compact).toBeVisible();
  const compactBox = await compact.boundingBox();
  expect(compactBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await compact.click();
  const close = page.getByRole("button", { name: "Close dialog" });
  await expect(close).toBeVisible();
  const closeBox = await close.boundingBox();
  expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(44);

  await context.close();
});

test("Stage 10 preserves keyboard command access after switching the application chrome to RTL", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.goto("/studio");
  await expect(page.getByRole("button", { name: /الأوامر/ })).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
  });

  const search = page.getByRole("textbox");
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
});
