import { expect, test, type Locator, type Page } from "@playwright/test";

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

async function createProject(page: Page, contentLocale: "en" | "ar"): Promise<void> {
  await page.goto("/studio/new");
  await expect(page.getByLabel("Project name")).toBeVisible();
  await page
    .getByLabel("Project name")
    .fill(contentLocale === "ar" ? "Stage Six Arabic Identity" : "Stage Six Identity");
  if (contentLocale === "ar") {
    await page.locator('input[name="content-locale"][value="ar"]').check();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
  await page.locator(".color-input-row .text-input").fill("#2456A6");
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

async function generateMinimalGuideAndOpenEditor(page: Page): Promise<void> {
  await page.getByLabel("Profile").selectOption("minimal");
  await page.getByRole("button", { name: "Generate guide" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your brand guide is generated from reusable semantic content.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit page" }).click();
  await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]+\/editor\/[0-9a-f-]+$/);
  await expect(page.getByRole("toolbar", { name: "Editor tools" })).toBeVisible();
}

async function dragLayer(
  page: Page,
  layer: Locator,
  dx: number,
  dy: number,
  steps = 24,
): Promise<void> {
  const box = await layer.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps });
  await page.mouse.up();
}

async function documentLeft(layer: Locator): Promise<number> {
  return layer.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
}

async function expectLeftNear(layer: Locator, expected: number): Promise<void> {
  await expect.poll(() => documentLeft(layer)).toBeCloseTo(expected, 1);
}

test("EN editor transforms one command, undo/redo persists after reload, and drag frame pacing is sampled", async ({
  page,
}) => {
  const runtimeIssues = captureRuntimeIssues(page);
  await createProject(page, "en");
  await generateMinimalGuideAndOpenEditor(page);
  const canvasRegion = page.getByRole("region", { name: "Canvas workspace" });
  await expect(canvasRegion).toHaveAccessibleDescription(/layers; .* visible/);

  await page.getByRole("button", { name: "Add rectangle (R)" }).click();
  const shape = page.locator(".editor-scene-layer--shape").last();
  await expect(shape).toBeVisible();
  const originalLeft = await documentLeft(shape);

  await dragLayer(page, shape, 90, 40);
  await expect.poll(() => documentLeft(shape)).not.toBe(originalLeft);
  const movedLeft = await documentLeft(shape);

  await page.getByRole("button", { name: "Undo" }).click();
  await expectLeftNear(shape, originalLeft);
  await page.getByRole("button", { name: "Redo" }).click();
  await expectLeftNear(shape, movedLeft);

  await page.reload();
  const reloadedShape = page.locator(".editor-scene-layer--shape").last();
  await expect(reloadedShape).toBeVisible();
  await expectLeftNear(reloadedShape, movedLeft);

  await reloadedShape.click();
  await page.evaluate(() => {
    const state = { active: true, last: 0, intervals: [] as number[] };
    (window as Window & { __hawyaFrames?: typeof state }).__hawyaFrames = state;
    const tick = (time: number) => {
      if (!state.active) return;
      if (state.last > 0) state.intervals.push(time - state.last);
      state.last = time;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const box = await reloadedShape.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 48; step += 1) {
    await page.mouse.move(startX + step * 2, startY + step, { steps: 1 });
    await page.waitForTimeout(5);
  }
  await page.mouse.up();
  await page.waitForTimeout(180);

  const pacing = await page.evaluate(() => {
    const state = (
      window as Window & {
        __hawyaFrames?: { active: boolean; last: number; intervals: number[] };
      }
    ).__hawyaFrames;
    if (!state)
      return { samples: 0, median: Number.POSITIVE_INFINITY, p95: Number.POSITIVE_INFINITY };
    state.active = false;
    const sorted = [...state.intervals].sort((a, b) => a - b);
    const percentile = (ratio: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ??
      Number.POSITIVE_INFINITY;
    return {
      samples: sorted.length,
      median: percentile(0.5),
      p95: percentile(0.95),
    };
  });
  expect(pacing.samples).toBeGreaterThanOrEqual(15);
  expect(pacing.median).toBeLessThan(30);
  expect(pacing.p95).toBeLessThan(60);
  expect(runtimeIssues).toEqual([]);
});

test("Arabic editor keeps physical canvas coordinates across UI RTL and persists bidi text plus transforms", async ({
  page,
}) => {
  const runtimeIssues = captureRuntimeIssues(page);
  await createProject(page, "ar");
  await generateMinimalGuideAndOpenEditor(page);

  await page.getByRole("button", { name: "Add text (T)" }).click();
  const createdTextLayer = page
    .locator(".editor-scene-layer--text")
    .filter({ hasText: "نص عربي" })
    .last();
  await expect(createdTextLayer).toBeVisible();
  const textLayerId = await createdTextLayer.getAttribute("data-layer-id");
  expect(textLayerId).not.toBeNull();
  if (!textLayerId) return;
  const textLayer = page.locator(`[data-layer-id="${textLayerId}"]`);
  await expect(textLayer).toHaveAttribute("dir", "rtl");
  await expect(textLayer).toHaveAttribute("lang", "ar");
  const leftBeforeUiRtl = await documentLeft(textLayer);

  await page.getByRole("button", { name: "Interface language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("region", { name: "مساحة لوحة التصميم" })).toHaveAccessibleDescription(
    /الطبقات/,
  );
  await expectLeftNear(textLayer, leftBeforeUiRtl);

  await textLayer.dblclick();
  const inline = textLayer.locator("textarea.editor-inline-text");
  await expect(inline).toHaveAttribute("dir", "rtl");
  await inline.fill("هوية عربية جديدة");
  await expect(inline).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(textLayer).toContainText("هوية عربية جديدة");

  const beforeMove = await documentLeft(textLayer);
  await dragLayer(page, textLayer, 72, 0);
  await expect.poll(() => documentLeft(textLayer)).not.toBe(beforeMove);
  const afterMove = await documentLeft(textLayer);

  await page.getByRole("button", { name: "تراجع" }).click();
  await expectLeftNear(textLayer, beforeMove);
  await page.getByRole("button", { name: "إعادة" }).click();
  await expectLeftNear(textLayer, afterMove);

  await page.reload();
  const persisted = page.locator(`[data-layer-id="${textLayerId}"]`);
  await expect(persisted).toBeVisible();
  await expect(persisted).toHaveAttribute("dir", "rtl");
  await expect(persisted).toContainText("هوية عربية جديدة");
  await expectLeftNear(persisted, afterMove);
  expect(runtimeIssues).toEqual([]);
});

test("Stage 10 layer deletion restores focus to an adjacent layer", async ({ page }) => {
  const runtimeIssues = captureRuntimeIssues(page);
  await createProject(page, "en");
  await generateMinimalGuideAndOpenEditor(page);

  await page.getByRole("button", { name: "Add rectangle (R)" }).click();
  await page.getByRole("button", { name: "Add rectangle (R)" }).click();

  const shapeRows = page.locator(".editor-layer-row").filter({ hasText: "extra · shape" });
  await expect(shapeRows).toHaveCount(2);
  const focusedName = shapeRows.first().locator(".editor-layer-row__name");
  await focusedName.click();
  await expect(focusedName).toBeFocused();

  await page.keyboard.press("Delete");

  const remainingRows = page.locator(".editor-layer-row").filter({ hasText: "extra · shape" });
  await expect(remainingRows).toHaveCount(1);
  const remainingName = remainingRows.first().locator(".editor-layer-row__name");
  await expect(remainingName).toBeFocused();
  await expect(remainingName).toHaveAttribute("aria-pressed", "true");
  expect(runtimeIssues).toEqual([]);
});
