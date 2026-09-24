import { expect, test } from "@playwright/test";

import type { Clock } from "@/application/ports/clock";
import { brandSystemPath, projectPath } from "@/app/routes/route-config";
import { isoDateTimeSchema, type ISODateTime } from "@/domain/common/primitives";
import { FflateProjectArchiveCodec } from "@/infrastructure/archive/fflate-project-archive-codec";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import { createStage10ScaleProjectFixture } from "../fixtures/stage10/scale-project";

class FixedClock implements Clock {
  constructor(private readonly value: ISODateTime) {}
  now(): ISODateTime {
    return this.value;
  }
}

test("Stage 10 representative project stays usable at 50 pages, 500 layers and 100 assets", async ({
  page,
}) => {
  const runtimeIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      runtimeIssues.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => runtimeIssues.push(`pageerror: ${error.message}`));

  const hasher = new WebCryptoSha256Hasher();
  const fixture = await createStage10ScaleProjectFixture(hasher);
  const codec = new FflateProjectArchiveCodec(
    hasher,
    new FixedClock(isoDateTimeSchema.parse("2026-09-24T12:00:00.000Z")),
  );
  const encoded = await codec.encode(fixture);
  expect(encoded.ok).toBe(true);
  if (!encoded.ok) throw encoded.error;

  await page.goto("/studio");
  const importStartedAt = Date.now();
  await page.locator('input[type="file"]').setInputFiles({
    name: "stage10-scale.hawya",
    mimeType: "application/zip",
    buffer: Buffer.from(encoded.value),
  });
  await expect(page).toHaveURL(projectPath(fixture.snapshot.project.id));
  await expect(page.locator(".guide-page-link")).toHaveCount(fixture.expected.pages);
  const guideReadyMs = Date.now() - importStartedAt;

  const activePreviews = page.locator(".guide-preview-section");
  await expect(activePreviews).toHaveCount(1);

  const assetsStartedAt = Date.now();
  await page.goto(brandSystemPath(fixture.snapshot.project.id));
  await expect(page.locator(".asset-card")).toHaveCount(fixture.expected.assets);
  const assetsReadyMs = Date.now() - assetsStartedAt;

  console.log("Stage10 scale metrics", {
    guideReadyMs,
    assetsReadyMs,
    pages: fixture.expected.pages,
    layers: fixture.expected.layers,
    assets: fixture.expected.assets,
  });
  expect(runtimeIssues).toEqual([]);
});
