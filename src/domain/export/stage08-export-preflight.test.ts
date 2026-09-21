import { describe, expect, it } from "vitest";

import { buildAuditReport } from "@/domain/audit/audit-engine";
import { runExportPreflight } from "@/domain/export/export-preflight";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import { createSyntheticProjectFixture } from "../../../tests/fixtures/stage02/synthetic-project";

describe("Stage 08 export preflight", () => {
  it("keeps incomplete projects backup-capable while blocking high-value artwork exports", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    fixture.snapshot.project.brand.logos.primaryLogoId = undefined;
    const hashes = new Set(fixture.binaries.map((binary) => binary.contentHash));
    const audit = buildAuditReport(fixture.snapshot, { has: (hash) => hashes.has(hash) });

    const backup = runExportPreflight({
      snapshot: fixture.snapshot,
      audit,
      availableBinaryHashes: hashes,
      format: "hawya",
    });
    const svg = runExportPreflight({
      snapshot: fixture.snapshot,
      audit,
      availableBinaryHashes: hashes,
      format: "svg-editable",
    });

    expect(backup.ok).toBe(true);
    expect(backup.issues).toContainEqual(
      expect.objectContaining({ code: "audit.missing-primary-logo", severity: "warning" }),
    );
    expect(svg.ok).toBe(false);
    expect(svg.issues).toContainEqual(
      expect.objectContaining({ code: "audit.missing-primary-logo", severity: "blocking" }),
    );
  });

  it("requires an explicit font inclusion policy for packaged exports", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    const hashes = new Set(fixture.binaries.map((binary) => binary.contentHash));
    const audit = buildAuditReport(fixture.snapshot, { has: (hash) => hashes.has(hash) });

    const missingPolicy = runExportPreflight({
      snapshot: fixture.snapshot,
      audit,
      availableBinaryHashes: hashes,
      format: "web-guide",
    });
    const omitFonts = runExportPreflight({
      snapshot: fixture.snapshot,
      audit,
      availableBinaryHashes: hashes,
      format: "web-guide",
      fontPolicy: "omit",
    });

    expect(missingPolicy.ok).toBe(false);
    expect(missingPolicy.issues).toContainEqual(
      expect.objectContaining({ code: "font-policy-required", severity: "blocking" }),
    );
    expect(omitFonts.issues.some((issue) => issue.code === "font-policy-required")).toBe(false);
  });

  it("promotes missing text-style coverage to a blocker for outlined/raster/print output", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    fixture.snapshot.project.brand.typography.styles = [];
    const hashes = new Set(fixture.binaries.map((binary) => binary.contentHash));
    const audit = buildAuditReport(fixture.snapshot, { has: (hash) => hashes.has(hash) });

    for (const format of ["svg-outlined", "png", "webp", "jpeg", "print"] as const) {
      const result = runExportPreflight({
        snapshot: fixture.snapshot,
        audit,
        availableBinaryHashes: hashes,
        format,
      });
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "font-style-required", severity: "blocking" }),
      );
    }
  });
});
