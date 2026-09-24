import { expect, test } from "@playwright/test";

function srgbChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.trim().replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

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

test("Stage 10 keeps the skip link keyboard-first and moves focus to main content", async ({
  page,
}) => {
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

  const navigationTrigger = page.getByRole("button", { name: "Open navigation" });
  await expect(navigationTrigger).toBeVisible();
  const triggerBox = await navigationTrigger.boundingBox();
  expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(triggerBox?.width ?? 0).toBeGreaterThanOrEqual(44);

  await navigationTrigger.click();
  const close = page.getByRole("button", { name: "Close navigation" });
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

test("Stage 10 keeps application chrome contrast within AA-oriented guardrails", async ({
  page,
}) => {
  await page.goto("/settings");

  for (const theme of ["Light", "Dark"] as const) {
    await page.getByRole("button", { name: theme }).click();
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        text1: style.getPropertyValue("--text-1").trim(),
        text2: style.getPropertyValue("--text-2").trim(),
        surface1: style.getPropertyValue("--surface-1").trim(),
        appBg: style.getPropertyValue("--app-bg").trim(),
        accent: style.getPropertyValue("--accent").trim(),
        accentForeground: style.getPropertyValue("--accent-foreground").trim(),
        focus: style.getPropertyValue("--focus").trim(),
      };
    });

    expect(contrastRatio(tokens.text1, tokens.surface1)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.text2, tokens.surface1)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.accentForeground, tokens.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.focus, tokens.appBg)).toBeGreaterThanOrEqual(3);
  }
});
