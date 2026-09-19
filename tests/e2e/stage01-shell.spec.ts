import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("landing and shell routes render without Hawya console errors or horizontal overflow", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  for (const pathname of ["/", "/studio", "/settings", "/about"]) {
    await page.goto(pathname);
    await expectNoHorizontalOverflow(page);
  }

  expect(consoleErrors).toEqual([]);
});

test("switching UI language updates html lang and dir without navigation or shell breakage", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  await page.getByRole("button", { name: "العربية" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "الإعدادات", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("theme choices affect chrome and survive a reload as non-critical UI preferences", async ({
  page,
}) => {
  await page.goto("/settings");

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("command menu is keyboard reachable and Escape restores focus", async ({ page }) => {
  await page.goto("/studio");

  await page.keyboard.press("/");
  const search = page.getByRole("textbox", { name: "Search commands…" });
  await expect(search).toBeFocused();
  await search.fill("settings");
  await expect(page.getByRole("button", { name: /Open Settings/ })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
  await expect(page.getByRole("button", { name: /Commands/ })).toBeFocused();
});

test("shortcut dialog traps interaction and can be exited from the keyboard", async ({ page }) => {
  await page.goto("/settings");
  const trigger = page.getByRole("button", { name: "View shortcuts" });
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("narrow shell uses accessible navigation dialog and never overflows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await expectNoHorizontalOverflow(page);

  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.goto("/settings");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "العربية" }).click();
  await expectNoHorizontalOverflow(page);
});
