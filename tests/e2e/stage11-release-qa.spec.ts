import { expect, test, type Locator, type Page } from "@playwright/test";

async function createArabicProjectAndOpenEditor(page: Page): Promise<void> {
  await page.goto("/studio/new");
  await page.getByLabel("Project name").fill("Stage Eleven RTL Stress");
  await page.locator('input[name="content-locale"][value="ar"]').check();
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

  await page.getByLabel("Profile").selectOption("minimal");
  await page.getByRole("button", { name: "Generate guide" }).click();
  await page.getByRole("button", { name: "Edit page" }).click();
  await expect(page.getByRole("toolbar", { name: "Editor tools" })).toBeVisible();
}

async function documentLeft(layer: Locator): Promise<number> {
  return layer.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
}

test("Stage 11 production CSP fallback boots the local-first application without violations", async ({
  page,
}) => {
  const runtimeIssues: string[] = [];
  page.on("console", (message) => {
    if (
      (message.type() === "error" || message.type() === "warning") &&
      /content security policy|refused to|violates.*directive/i.test(message.text())
    ) {
      runtimeIssues.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => runtimeIssues.push(`pageerror: ${error.message}`));

  await page.goto("/studio");
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).not.toContain("unsafe-eval");
  expect(policy).not.toContain("*");
  await expect(page.getByRole("button", { name: "Create project" }).first()).toBeVisible();
  expect(runtimeIssues).toEqual([]);
});

test("Stage 11 preserves mixed bidi stress text and physical canvas coordinates across UI RTL", async ({
  page,
}) => {
  await createArabicProjectAndOpenEditor(page);
  await page.getByRole("button", { name: "Add text (T)" }).click();

  const createdTextLayer = page.locator(".editor-scene-layer--text").last();
  await expect(createdTextLayer).toBeVisible();
  const textLayerId = await createdTextLayer.getAttribute("data-layer-id");
  expect(textLayerId).not.toBeNull();
  if (!textLayerId) return;
  const textLayer = page.locator(`[data-layer-id="${textLayerId}"]`);
  const beforeUiRtl = await documentLeft(textLayer);

  const stressSamples = [
    "الهوية (Hawya Studio) — الإصدار ٢٠٢٦ / 2026 — hello@example.com — https://hawya.local/path?x=١٢٣ — السَّلَامُ عَلَيْكُمْ",
    "(123) — hello@example.com — https://hawya.local/123",
    "عنوان عربي طويل جدًا لاختبار الالتفاف مع Brand 2026 ورقم ١٢٣٤٥٦ وعلامات ( ) [ ] — بدون تغيير إحداثيات اللوحة",
  ];

  for (const sample of stressSamples) {
    await textLayer.dblclick();
    const inline = textLayer.locator("textarea.editor-inline-text");
    await inline.fill(sample);
    await page.keyboard.press("Tab");
    await expect(textLayer).toContainText(sample);
    await expect(textLayer).toHaveAttribute("dir", "rtl");
  }

  await page.getByRole("button", { name: "Interface language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect.poll(() => documentLeft(textLayer)).toBeCloseTo(beforeUiRtl, 1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await page.reload();
  const persisted = page.locator(`[data-layer-id="${textLayerId}"]`);
  await expect(persisted).toContainText(stressSamples.at(-1) ?? "");
  await expect(persisted).toHaveAttribute("dir", "rtl");
});
