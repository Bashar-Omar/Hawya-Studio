import { readdirSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const EVIDENCE_DIR = resolve("release-evidence");
const CORPUS_ENTRY_COUNT = 16;
const CORPUS_ENTRY_BYTES = 8 * 1024 * 1024;
const EXPECTED_CORPUS_BYTES = CORPUS_ENTRY_COUNT * CORPUS_ENTRY_BYTES;

interface FocusEvidence {
  step: number;
  tag: string;
  role: string | null;
  name: string;
}

function safeSvg(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect x="10" y="10" width="100" height="60" rx="12" fill="#112233"/><circle cx="60" cy="40" r="16" fill="#F2C14E"/></svg>',
  );
}

function arabicFontPath(): string {
  const entry = fileURLToPath(
    import.meta.resolve("@fontsource-variable/noto-sans-arabic/index.css"),
  );
  const filesDirectory = join(dirname(entry), "files");
  const candidate = readdirSync(filesDirectory).find(
    (name) => name.endsWith(".woff2") && name.includes("arabic") && name.includes("wght"),
  );
  if (!candidate) throw new Error("Arabic WOFF2 release fixture was not found");
  return join(filesDirectory, candidate);
}

async function captureKeyboardTrail(page: Page): Promise<FocusEvidence[]> {
  const trail: FocusEvidence[] = [];
  for (let step = 1; step <= 12; step += 1) {
    await page.keyboard.press("Tab");
    trail.push(
      await page.evaluate((currentStep) => {
        const element = document.activeElement as HTMLElement | null;
        return {
          step: currentStep,
          tag: element?.tagName.toLowerCase() ?? "none",
          role: element?.getAttribute("role") ?? null,
          name:
            element?.getAttribute("aria-label") ??
            element?.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) ??
            "",
        };
      }, step),
    );
  }
  return trail;
}

async function persistLargeLocalCorpus(page: Page) {
  return page.evaluate(
    async ({ entryCount, entryBytes }) => {
      const database = await new Promise<IDBDatabase>((resolveDatabase, rejectDatabase) => {
        const request = indexedDB.open("hawya-studio");
        request.onerror = () => rejectDatabase(request.error);
        request.onsuccess = () => resolveDatabase(request.result);
      });

      if (!database.objectStoreNames.contains("binaries")) {
        database.close();
        throw new Error("Hawya binary store is unavailable");
      }

      for (let index = 0; index < entryCount; index += 1) {
        const bytes = new Uint8Array(entryBytes);
        bytes.fill((index * 17 + 31) % 251);
        bytes[0] = index;
        const contentHash = (index + 1).toString(16).padStart(64, "0");

        await new Promise<void>((resolveWrite, rejectWrite) => {
          const transaction = database.transaction("binaries", "readwrite");
          transaction.objectStore("binaries").put({
            contentHash,
            blob: new Blob([bytes], { type: "application/octet-stream" }),
            byteLength: bytes.byteLength,
            mime: "application/octet-stream",
            createdAt: new Date(0).toISOString(),
          });
          transaction.oncomplete = () => resolveWrite();
          transaction.onerror = () => rejectWrite(transaction.error);
          transaction.onabort = () => rejectWrite(transaction.error);
        });
      }

      const summary = await new Promise<{ count: number; bytes: number }>(
        (resolveSummary, rejectSummary) => {
          const transaction = database.transaction("binaries", "readonly");
          const request = transaction.objectStore("binaries").getAll();
          request.onerror = () => rejectSummary(request.error);
          request.onsuccess = () => {
            const rows = request.result as Array<{ byteLength?: number }>;
            resolveSummary({
              count: rows.length,
              bytes: rows.reduce((total, row) => total + Number(row.byteLength ?? 0), 0),
            });
          };
        },
      );

      database.close();
      return summary;
    },
    { entryCount: CORPUS_ENTRY_COUNT, entryBytes: CORPUS_ENTRY_BYTES },
  );
}

async function readLargeLocalCorpus(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolveDatabase, rejectDatabase) => {
      const request = indexedDB.open("hawya-studio");
      request.onerror = () => rejectDatabase(request.error);
      request.onsuccess = () => resolveDatabase(request.result);
    });

    const summary = await new Promise<{ count: number; bytes: number }>(
      (resolveSummary, rejectSummary) => {
        const transaction = database.transaction("binaries", "readonly");
        const request = transaction.objectStore("binaries").getAll();
        request.onerror = () => rejectSummary(request.error);
        request.onsuccess = () => {
          const rows = request.result as Array<{ byteLength?: number }>;
          resolveSummary({
            count: rows.length,
            bytes: rows.reduce((total, row) => total + Number(row.byteLength ?? 0), 0),
          });
        };
      },
    );

    database.close();
    return summary;
  });
}

async function createArabicReleaseProject(page: Page): Promise<void> {
  await page.goto("/settings");
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.screenshot({ path: join(EVIDENCE_DIR, "02-settings-ar-rtl.png"), fullPage: true });

  await page.goto("/studio");
  await page.getByRole("button", { name: "إنشاء مشروع" }).first().click();
  await page.getByLabel("اسم المشروع").fill("هوية الإصدار العام");
  await page.locator('input[name="content-locale"][value="ar"]').check();
  await page.getByRole("button", { name: "متابعة" }).click();

  for (const heading of ["الألوان", "الخطوط", "أساس الهوية", "الدليل"]) {
    await page.getByRole("button", { name: "تخطي الآن" }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await page.getByRole("button", { name: "إنهاء الإعداد" }).click();
  await expect(
    page.getByRole("heading", { name: "اكتمل الإعداد وهيكل الدليل جاهز." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.screenshot({ path: join(EVIDENCE_DIR, "03-project-ar-rtl.png"), fullPage: true });
}

async function createExportReadyProject(page: Page): Promise<void> {
  await page.goto("/studio/new");
  await page.getByLabel("Project name").fill("Stage Twelve Release Evidence");
  await page.locator("label.checkbox-row").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
  await page.locator(".color-input-row .text-input").fill("#112233");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Typography" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Guide" })).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();

  await page.getByRole("button", { name: "Open Brand System" }).click();
  await page.getByRole("tab", { name: "Logos" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "stage-twelve-logo.svg",
    mimeType: "image/svg+xml",
    buffer: safeSvg(),
  });
  await page.getByRole("button", { name: "Add variant" }).click();
  await expect(page.getByText("Primary", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Typography" }).click();
  await page
    .getByLabel("License / rights note")
    .fill("OFL release fixture from installed Fontsource dependency");
  await page.locator('input[type="file"]').setInputFiles(arabicFontPath());
  await expect(page.locator(".font-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Add text style" }).click();
  await expect(page.locator(".type-style-card")).toHaveCount(1);

  await page.getByRole("button", { name: "Guide shell" }).click();
  await page.getByLabel("Profile").selectOption("minimal");
  await page.getByLabel("Document locale mode").selectOption("bilingual");
  await page.getByRole("button", { name: "Generate guide" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your brand guide is generated from reusable semantic content.",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("heading", { name: "Export Center" })).toBeVisible();
}

async function acknowledgeWarningsIfPresent(page: Page): Promise<void> {
  const acknowledgement = page.getByText("I reviewed these warnings and want to continue.");
  if (await acknowledgement.isVisible().catch(() => false)) {
    await acknowledgement.locator("..").getByRole("checkbox").check();
  }
}

test("Stage 12 captures auditable release-candidate evidence", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const runtimeIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      runtimeIssues.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => runtimeIssues.push(`pageerror: ${error.message}`));

  await page.goto("/studio");
  await expect(page.getByRole("button", { name: "Create project" }).first()).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE_DIR, "01-studio-en.png"), fullPage: true });

  const keyboardTrail = await captureKeyboardTrail(page);
  expect(keyboardTrail.filter((entry) => entry.tag !== "body" && entry.tag !== "none").length).toBe(
    keyboardTrail.length,
  );
  expect(new Set(keyboardTrail.map((entry) => `${entry.tag}:${entry.name}`)).size).toBeGreaterThan(
    4,
  );

  const corpusBeforeReload = await persistLargeLocalCorpus(page);
  expect(corpusBeforeReload.count).toBeGreaterThanOrEqual(CORPUS_ENTRY_COUNT);
  expect(corpusBeforeReload.bytes).toBeGreaterThanOrEqual(EXPECTED_CORPUS_BYTES);

  await page.reload();
  await expect(page.getByRole("button", { name: "Create project" }).first()).toBeVisible();
  const corpusAfterReload = await readLargeLocalCorpus(page);
  expect(corpusAfterReload.bytes).toBeGreaterThanOrEqual(EXPECTED_CORPUS_BYTES);

  await createArabicReleaseProject(page);

  await page.goto("/settings");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await createExportReadyProject(page);
  await page.getByRole("button", { name: /Browser Print \/ PDF/ }).click();
  await acknowledgeWarningsIfPresent(page);

  const openPrint = page.getByRole("button", { name: "Open Print View" });
  await expect(openPrint).toBeEnabled();
  await openPrint.click();
  await expect(page.locator(".hawya-print-view")).toHaveAttribute("data-print-ready", "true", {
    timeout: 15_000,
  });
  await expect(page.locator(".hawya-print-sheet")).not.toHaveCount(0);
  const overflowingTextLayers = await page.locator(".hawya-print-layer--text").evaluateAll((layers) =>
    layers
      .filter(
        (layer) =>
          layer.scrollHeight > layer.clientHeight + 1 || layer.scrollWidth > layer.clientWidth + 1,
      )
      .map((layer) => layer.getAttribute("data-layer-id")),
  );
  expect(overflowingTextLayers).toEqual([]);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await page.screenshot({
    path: join(EVIDENCE_DIR, "04-print-view-bilingual.png"),
    fullPage: true,
  });
  const pdfPath = join(EVIDENCE_DIR, "05-brand-guidelines-bilingual.pdf");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  const pdfInfo = await stat(pdfPath);
  expect(pdfInfo.size).toBeGreaterThan(10_000);

  const evidence = {
    releaseSha: process.env.HAWYA_RELEASE_SHA ?? "local",
    browser: "chromium",
    uiEvidence: {
      englishStudio: "01-studio-en.png",
      arabicSettings: "02-settings-ar-rtl.png",
      arabicProject: "03-project-ar-rtl.png",
      bilingualPrintView: "04-print-view-bilingual.png",
      verifiedArabicLang: "ar",
      verifiedArabicDirection: "rtl",
    },
    keyboard: {
      steps: keyboardTrail.length,
      trail: keyboardTrail,
    },
    localCorpus: {
      targetBytes: EXPECTED_CORPUS_BYTES,
      beforeReload: corpusBeforeReload,
      afterReload: corpusAfterReload,
    },
    pdf: {
      file: "05-brand-guidelines-bilingual.pdf",
      byteLength: pdfInfo.size,
      overflowingTextLayers,
    },
    runtimeIssues,
  };

  await writeFile(
    join(EVIDENCE_DIR, "release-evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  expect(runtimeIssues).toEqual([]);
});
