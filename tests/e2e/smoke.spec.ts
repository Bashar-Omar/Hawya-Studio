import { expect, test } from "@playwright/test";

test("loads the Hawya Studio foundation without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page).toHaveTitle("Hawya Studio");
  await expect(page.getByRole("heading", { name: "Hawya Studio" })).toBeVisible();
  await expect(page.getByText("ستديو هوية")).toBeVisible();
  await expect(page.getByText("Free · Open source · Local-first")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
