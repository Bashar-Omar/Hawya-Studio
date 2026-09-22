import type { AuditIssue, AuditReport } from "@/domain/audit/audit-engine";
import type {
  ExportFormat,
  ExportPreflightIssue,
  ExportPreflightResult,
  FontInclusionPolicy,
} from "@/domain/export/export-contract";
import { projectSnapshotSchema, type ProjectSnapshot } from "@/domain/project/hawya-project";

const ALWAYS_BLOCKING_AUDIT_CODES = new Set<AuditIssue["code"]>([
  "missing-binary",
  "unsanitized-svg",
  "missing-logo-asset",
  "missing-font-asset",
  "missing-layer-asset",
  "missing-project-asset",
  "missing-color-token",
  "missing-text-style-token",
  "incompatible-page-template",
  "zero-layer-size",
]);

const ARTWORK_FORMATS = new Set<ExportFormat>([
  "svg-editable",
  "svg-outlined",
  "png",
  "webp",
  "jpeg",
  "print",
  "web-guide",
  "delivery",
]);

const FONT_RENDERING_FORMATS = new Set<ExportFormat>([
  "svg-outlined",
  "png",
  "webp",
  "jpeg",
  "print",
]);

export interface ExportPreflightInput {
  snapshot: ProjectSnapshot;
  audit: AuditReport;
  availableBinaryHashes: ReadonlySet<string>;
  format: ExportFormat;
  fontPolicy?: FontInclusionPolicy;
}

function pushUnique(issues: ExportPreflightIssue[], issue: ExportPreflightIssue): void {
  if (
    issues.some(
      (candidate) =>
        candidate.code === issue.code &&
        candidate.location === issue.location &&
        candidate.detail === issue.detail,
    )
  ) {
    return;
  }
  issues.push(issue);
}

function fromAudit(issue: AuditIssue, format: ExportFormat): ExportPreflightIssue | undefined {
  if (issue.severity === "info") return undefined;

  let severity: ExportPreflightIssue["severity"] = "warning";
  if (format === "hawya") {
    severity = issue.code === "missing-binary" ? "blocking" : "warning";
  } else if (ALWAYS_BLOCKING_AUDIT_CODES.has(issue.code)) {
    severity = "blocking";
  }
  if (issue.code === "missing-primary-logo" && ARTWORK_FORMATS.has(format)) severity = "blocking";

  return {
    code: `audit.${issue.code}`,
    severity,
    location: issue.location,
    ...(issue.detail ? { detail: issue.detail } : {}),
  };
}

function textBearingProject(snapshot: ProjectSnapshot): boolean {
  if (snapshot.project.guide.pageOrder.length === 0) return false;
  return snapshot.project.guide.pageOrder.some((pageId) => {
    const page = snapshot.project.guide.pages[pageId];
    if (!page) return false;
    return (
      page.extras.some((layer) => layer.type === "text") ||
      Object.keys(page.templateBinding.slotBindings).length > 0
    );
  });
}

export function runExportPreflight(input: ExportPreflightInput): ExportPreflightResult {
  const issues: ExportPreflightIssue[] = [];
  const parsed = projectSnapshotSchema.safeParse(input.snapshot);
  if (!parsed.success) {
    issues.push({
      code: "schema-invalid",
      severity: "blocking",
      location: "project",
      detail: parsed.error.issues[0]?.message ?? "Project snapshot is invalid",
    });
  }

  for (const auditIssue of input.audit.issues) {
    const converted = fromAudit(auditIssue, input.format);
    if (converted) pushUnique(issues, converted);
  }

  for (const pageId of input.snapshot.project.guide.pageOrder) {
    const page = input.snapshot.project.guide.pages[pageId];
    if (!page) {
      pushUnique(issues, {
        code: "missing-page",
        severity: "blocking",
        location: `page:${pageId}`,
      });
      continue;
    }
    if (!(page.canvas.width > 0) || !(page.canvas.height > 0)) {
      pushUnique(issues, {
        code: "invalid-page-dimensions",
        severity: "blocking",
        location: `page:${pageId}`,
      });
    }
  }

  const needsRenderedFonts =
    FONT_RENDERING_FORMATS.has(input.format) && textBearingProject(input.snapshot);
  const needsPackagedFonts =
    (input.format === "web-guide" || input.format === "delivery") &&
    input.fontPolicy === "include-confirmed";

  if (needsRenderedFonts && !input.snapshot.project.brand.typography.styles.length) {
    pushUnique(issues, {
      code: "font-style-required",
      severity: "blocking",
      location: "brand:typography",
      detail: "Outlined/raster/print export requires at least one semantic text style.",
    });
  }

  if (needsRenderedFonts || needsPackagedFonts) {
    const assets = new Map(input.snapshot.assets.map((asset) => [asset.id, asset] as const));
    const fonts = new Map(
      input.snapshot.project.brand.typography.fonts.map((font) => [font.id, font] as const),
    );
    for (const style of input.snapshot.project.brand.typography.styles) {
      if (!fonts.has(style.fontRefId)) {
        pushUnique(issues, {
          code: "font-reference-missing",
          severity: "blocking",
          location: `brand:text-style:${style.id}`,
          detail: style.name,
        });
      }
    }
    for (const font of input.snapshot.project.brand.typography.fonts) {
      const asset = assets.get(font.assetId);
      if (!asset) continue;
      if (!input.availableBinaryHashes.has(asset.binaryKey)) {
        pushUnique(issues, {
          code: "font-binary-missing",
          severity: "blocking",
          location: `brand:font:${font.id}`,
          detail: font.familyName,
        });
      }
    }
  }

  if (
    (input.format === "web-guide" || input.format === "delivery") &&
    input.fontPolicy === undefined
  ) {
    pushUnique(issues, {
      code: "font-policy-required",
      severity: "blocking",
      location: "export:font-policy",
      detail: "Choose whether font binaries are omitted or explicitly included.",
    });
  }

  issues.sort(
    (left, right) =>
      (left.severity === right.severity ? 0 : left.severity === "blocking" ? -1 : 1) ||
      left.code.localeCompare(right.code) ||
      left.location.localeCompare(right.location),
  );
  const counts = {
    warning: issues.filter((issue) => issue.severity === "warning").length,
    blocking: issues.filter((issue) => issue.severity === "blocking").length,
  };
  return { ok: counts.blocking === 0, issues, counts };
}
