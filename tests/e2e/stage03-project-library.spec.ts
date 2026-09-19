import { expect, test, type Page } from "@playwright/test";

async function startProject(page: Page, name: string): Promise<void> {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Create project" }).first().click();
  await expect(page).toHaveURL(/\/studio\/new$/);
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Logo" })).toBeVisible();
}

async function finishMinimalEnglishProject(page: Page, name: string): Promise<void> {
  await startProject(page, name);
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
}

test("English minimal setup survives a page close/reopen and finishes at the empty guide shell", async ({
  page,
  context,
}) => {
  await startProject(page, "Resume Identity");
  const resumeUrl = page.url();

  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(resumeUrl);
  await expect(reopened.getByRole("heading", { name: "Logo" })).toBeVisible();
  await reopened.getByRole("button", { name: "Skip for now" }).click();
  await expect(reopened.getByRole("heading", { name: "Colors" })).toBeVisible();
  await reopened.reload();
  await expect(reopened.getByRole("heading", { name: "Colors" })).toBeVisible();

  await reopened.getByRole("button", { name: "Skip for now" }).click();
  await reopened.getByRole("button", { name: "Skip for now" }).click();
  await reopened.getByRole("button", { name: "Skip for now" }).click();
  await expect(reopened.getByRole("heading", { name: "Guide" })).toBeVisible();
  await reopened.getByRole("button", { name: "Finish setup" }).click();

  await expect(
    reopened.getByRole("heading", { name: "Setup complete. The guide shell is ready." }),
  ).toBeVisible();
  await expect(reopened.getByText("No guide pages generated yet")).toBeVisible();
});

test("Arabic UI completes a minimal project with RTL intact", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.goto("/studio");
  await page.getByRole("button", { name: "إنشاء مشروع" }).first().click();
  await page.getByLabel("اسم المشروع").fill("هوية عربية");
  await page.getByRole("button", { name: "متابعة" }).click();
  await expect(page.getByRole("heading", { name: "الشعار" })).toBeVisible();

  for (const heading of ["الألوان", "الخطوط", "أساس الهوية", "الدليل"]) {
    await page.getByRole("button", { name: "تخطي الآن" }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await page.getByRole("button", { name: "إنهاء الإعداد" }).click();
  await expect(
    page.getByRole("heading", { name: "اكتمل الإعداد وهيكل الدليل جاهز." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("project library supports rename, duplicate, backup export, delete and .hawya import", async ({
  page,
}) => {
  await finishMinimalEnglishProject(page, "Portable Identity");
  await page.getByRole("button", { name: "Back to projects" }).click();
  await expect(page.getByRole("heading", { name: "Portable Identity" })).toBeVisible();

  await page.getByRole("button", { name: "Rename" }).click();
  const renameDialog = page.getByRole("dialog");
  const renameInput = renameDialog.getByLabel("Project name");
  await renameInput.fill("Portable Identity Renamed");
  await renameDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Portable Identity Renamed" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Portable-Identity-Renamed.hawya");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(
    page.getByRole("heading", { name: "Setup complete. The guide shell is ready." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to projects" }).click();
  await expect(page.getByRole("heading", { name: "Portable Identity Renamed Copy" })).toBeVisible();

  const deleteButtons = page.getByRole("button", { name: "Delete" });
  await deleteButtons.first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
  await expect(page.locator("article.project-card")).toHaveCount(1);

  if (!downloadPath) {
    throw new Error("Expected Playwright download path");
  }
  await page.locator('input[type="file"]').setInputFiles(downloadPath);
  await expect(
    page.getByRole("heading", { name: "Setup complete. The guide shell is ready." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to projects" }).click();
  await expect(page.locator("article.project-card")).toHaveCount(2);
});
