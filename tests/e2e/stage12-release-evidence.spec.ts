import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

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

async function createArabicReleaseProject(page: Page): Promise<string> {
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
  return page.url();
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

  const guideShellUrl = await createArabicReleaseProject(page);

  await page.goto("/settings");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto(guideShellUrl);

  await page.getByLabel("Profile").selectOption("minimal");
  await page.getByLabel("Document locale mode").selectOption("ar");
  await page.getByRole("button", { name: "Generate guide" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your brand guide is generated from reusable semantic content.",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /Browser Print \/ PDF/ }).click();

  const acknowledgement = page.getByText("I reviewed these warnings and want to continue.");
  if (await acknowledgement.isVisible().catch(() => false)) {
    await acknowledgement.locator("..").getByRole("checkbox").check();
  }

  const openPrint = page.getByRole("button", { name: "Open Print View" });
  await expect(openPrint).toBeEnabled();
  await openPrint.click();
  await expect(page.locator(".hawya-print-view")).toHaveAttribute("data-print-ready", "true", {
    timeout: 15_000,
  });
  await expect(page.locator(".hawya-print-sheet")).not.toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await page.screenshot({ path: join(EVIDENCE_DIR, "04-print-view-ar.png"), fullPage: true });
  const pdfPath = join(EVIDENCE_DIR, "05-brand-guidelines-ar.pdf");
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
      arabicPrintView: "04-print-view-ar.png",
      lang: "ar",
      direction: "rtl",
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
      file: "05-brand-guidelines-ar.pdf",
      byteLength: pdfInfo.size,
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
