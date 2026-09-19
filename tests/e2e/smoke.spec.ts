import { expect, test } from "@playwright/test";

test("loads the Hawya Studio landing foundation without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page).toHaveTitle("Hawya Studio");
  await expect(
    page.getByRole("heading", { name: "Encode the brand once. Publish it everywhere." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Studio" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
