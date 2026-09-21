import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import { ASSET_WARN_BYTES } from "@/domain/assets/asset-policy";
import { guidePageStatus } from "@/domain/guide/guide-status";
import { templateById } from "@/domain/templates/template-engine";

export type AuditSeverity = "info" | "warning" | "blocking";

export type AuditIssueCode =
  | "missing-primary-logo"
  | "missing-primary-color"
  | "missing-body-style"
  | "unresolved-guide-page"
  | "missing-binary"
  | "duplicate-source-hash"
  | "huge-asset"
  | "unsanitized-svg"
  | "missing-logo-asset"
  | "missing-font-asset"
  | "missing-layer-asset"
  | "missing-color-token"
  | "detached-color-token"
  | "stale-print-value"
  | "arabic-font-coverage"
  | "arabic-font-shaping-review"
  | "invalid-local-override"
  | "layer-outside-page"
  | "zero-layer-size"
  | "hidden-required-slot";

export type AuditQuickFix =
  | { type: "use-color-token"; pageId: string; layerId: string; tokenId: string }
  | { type: "fit-layer-to-page"; pageId: string; layerId: string }
  | { type: "show-template-layer"; pageId: string; targetId: string }
  | { type: "remove-local-override"; pageId: string; targetId: string };

export interface AuditIssue {
  id: string;
  code: AuditIssueCode;
  severity: AuditSeverity;
  location: string;
  detail?: string;
  quickFix?: AuditQuickFix;
}

export interface AuditReport {
  issues: AuditIssue[];
  counts: Record<AuditSeverity, number>;
}

interface BinaryAvailability {
  has(contentHash: string): boolean;
}

function issue(
  code: AuditIssueCode,
  severity: AuditSeverity,
  location: string,
  detail?: string,
  quickFix?: AuditQuickFix,
): AuditIssue {
  return {
    id: `${code}:${location}${detail ? `:${detail}` : ""}`,
    code,
    severity,
    location,
    ...(detail ? { detail } : {}),
    ...(quickFix ? { quickFix } : {}),
  };
}

function normalizeHex(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : undefined;
}

function referencedAssetId(
  layer: ProjectSnapshot["project"]["guide"]["pages"][string]["extras"][number],
): string | undefined {
  if (layer.type === "image") return layer.assetId;
  if (layer.type === "vector" && typeof layer.data.assetId === "string") return layer.data.assetId;
  return undefined;
}

function localOverrideTarget(candidate: Record<string, unknown>): string | undefined {
  return typeof candidate.targetId === "string" ? candidate.targetId : undefined;
}

function localOverrideVisible(candidate: Record<string, unknown>): boolean | undefined {
  return typeof candidate.visible === "boolean" ? candidate.visible : undefined;
}

function boundsIssue(
  pageId: string,
  pageWidth: number,
  pageHeight: number,
  layer: ProjectSnapshot["project"]["guide"]["pages"][string]["extras"][number],
): AuditIssue[] {
  const transform = layer.transform;
  const location = `page:${pageId}:layer:${layer.id}`;
  if (transform.width <= 0 || transform.height <= 0) {
    return [
      issue("zero-layer-size", "blocking", location, layer.name, {
        type: "fit-layer-to-page",
        pageId,
        layerId: layer.id,
      }),
    ];
  }
  const normalizedRotation = ((transform.rotation % 360) + 360) % 360;
  const radians = (normalizedRotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const boundingWidth = transform.width * cos + transform.height * sin;
  const boundingHeight = transform.width * sin + transform.height * cos;
  const centerX = transform.x + transform.width / 2;
  const centerY = transform.y + transform.height / 2;
  const bounds = {
    x: centerX - boundingWidth / 2,
    y: centerY - boundingHeight / 2,
    width: boundingWidth,
    height: boundingHeight,
  };
  const outside =
    bounds.x < 0 ||
    bounds.y < 0 ||
    bounds.x + bounds.width > pageWidth ||
    bounds.y + bounds.height > pageHeight;
  const quickFix =
    normalizedRotation === 0
      ? ({ type: "fit-layer-to-page", pageId, layerId: layer.id } as const)
      : undefined;
  return outside ? [issue("layer-outside-page", "warning", location, layer.name, quickFix)] : [];
}

function auditTextLayerTokens(
  snapshot: ProjectSnapshot,
  pageId: string,
  layer: ProjectSnapshot["project"]["guide"]["pages"][string]["extras"][number],
): AuditIssue[] {
  if (layer.type !== "text") return [];
  const tokens = snapshot.project.brand.colors.tokens;
  const tokenIds = new Set(tokens.map((token) => token.id));
  const location = `page:${pageId}:layer:${layer.id}`;
  if ("colorTokenId" in layer.fill) {
    return tokenIds.has(layer.fill.colorTokenId)
      ? []
      : [issue("missing-color-token", "blocking", location, layer.fill.colorTokenId)];
  }
  if (layer.fill.type !== "solid") return [];
  const localHex = normalizeHex(layer.fill.color);
  if (!localHex) return [];
  const matching = tokens.find((token) => token.srgbHex.toUpperCase() === localHex);
  return matching
    ? [
        issue(
          "detached-color-token",
          "warning",
          location,
          matching.name.en ?? matching.name.ar ?? matching.srgbHex,
          { type: "use-color-token", pageId, layerId: layer.id, tokenId: matching.id },
        ),
      ]
    : [];
}

export function buildAuditReport(
  snapshot: ProjectSnapshot,
  binaries: BinaryAvailability,
): AuditReport {
  const issues: AuditIssue[] = [];
  const assetsById = new Map(snapshot.assets.map((asset) => [asset.id, asset] as const));
  const tokenIds = new Set(snapshot.project.brand.colors.tokens.map((token) => token.id));
  const arabicEnabled = snapshot.project.settings.enabledContentLocales.includes("ar");

  const primaryLogoId = snapshot.project.brand.logos.primaryLogoId;
  if (
    !primaryLogoId ||
    !snapshot.project.brand.logos.variants.some((variant) => variant.id === primaryLogoId)
  ) {
    issues.push(issue("missing-primary-logo", "blocking", "brand:logos"));
  }
  if (!snapshot.project.brand.colors.tokens.some((token) => token.role === "primary")) {
    issues.push(issue("missing-primary-color", "warning", "brand:colors"));
  }
  if (!snapshot.project.brand.typography.styles.some((style) => style.role === "body")) {
    issues.push(issue("missing-body-style", "warning", "brand:typography"));
  }

  for (const token of snapshot.project.brand.colors.tokens) {
    if (token.print?.verifiedCmykNeedsReview) {
      issues.push(
        issue(
          "stale-print-value",
          "warning",
          `brand:color:${token.id}`,
          token.name.en ?? token.name.ar ?? token.srgbHex,
        ),
      );
    }
  }

  for (const variant of snapshot.project.brand.logos.variants) {
    if (!assetsById.has(variant.assetId)) {
      issues.push(
        issue("missing-logo-asset", "blocking", `brand:logo:${variant.id}`, variant.assetId),
      );
    }
    if (variant.preferredBackground && !tokenIds.has(variant.preferredBackground)) {
      issues.push(
        issue(
          "missing-color-token",
          "warning",
          `brand:logo:${variant.id}:background`,
          variant.preferredBackground,
        ),
      );
    }
  }

  for (const font of snapshot.project.brand.typography.fonts) {
    const asset = assetsById.get(font.assetId);
    if (asset?.kind !== "font") {
      issues.push(
        issue("missing-font-asset", "blocking", `brand:font:${font.id}`, font.familyName),
      );
      continue;
    }
    if (arabicEnabled) {
      const arabic = font.coverage?.arabic as
        | { ratio?: unknown; hasGsub?: unknown; hasGpos?: unknown }
        | undefined;
      if (typeof arabic?.ratio === "number" && arabic.ratio < 0.9) {
        issues.push(
          issue(
            "arabic-font-coverage",
            "warning",
            `brand:font:${font.id}`,
            `${font.familyName} ${Math.round(arabic.ratio * 100)}%`,
          ),
        );
      }
      if (arabic && (arabic.hasGsub !== true || arabic.hasGpos !== true)) {
        issues.push(
          issue(
            "arabic-font-shaping-review",
            "warning",
            `brand:font:${font.id}:shaping`,
            font.familyName,
          ),
        );
      }
    }
  }

  for (const asset of snapshot.assets) {
    if (!binaries.has(asset.binaryKey)) {
      issues.push(issue("missing-binary", "blocking", `asset:${asset.id}`, asset.originalFilename));
    }
    if (asset.byteLength >= ASSET_WARN_BYTES) {
      issues.push(issue("huge-asset", "warning", `asset:${asset.id}`, asset.originalFilename));
    }
    if (asset.mime === "image/svg+xml" && asset.security.sanitized !== true) {
      issues.push(
        issue("unsanitized-svg", "blocking", `asset:${asset.id}`, asset.originalFilename),
      );
    }
  }
  const hashGroups = new Map<string, string[]>();
  for (const asset of snapshot.assets) {
    const ids = hashGroups.get(asset.contentHash) ?? [];
    ids.push(asset.id);
    hashGroups.set(asset.contentHash, ids);
  }
  for (const [hash, ids] of hashGroups) {
    if (ids.length > 1) {
      issues.push(issue("duplicate-source-hash", "info", `asset-hash:${hash}`, String(ids.length)));
    }
  }

  for (const pageId of snapshot.project.guide.pageOrder) {
    const page = snapshot.project.guide.pages[pageId];
    if (!page) continue;
    if (guidePageStatus(snapshot, page) === "needs-input") {
      issues.push(issue("unresolved-guide-page", "warning", `page:${pageId}`, page.semanticType));
    }
    const template = templateById(page.templateBinding.templateId);
    const validTemplateTargets = new Set(
      template?.slots.map((slot) => `template:${slot.id}`) ?? [],
    );
    const requiredTemplateTargets = new Set(
      template?.slots.filter((slot) => slot.required).map((slot) => `template:${slot.id}`) ?? [],
    );
    for (const candidate of page.localOverrides) {
      const targetId = localOverrideTarget(candidate);
      if (!targetId) continue;
      if (!validTemplateTargets.has(targetId)) {
        issues.push(
          issue(
            "invalid-local-override",
            "warning",
            `page:${pageId}:override:${targetId}`,
            targetId,
            { type: "remove-local-override", pageId, targetId },
          ),
        );
      } else if (
        requiredTemplateTargets.has(targetId) &&
        localOverrideVisible(candidate) === false
      ) {
        issues.push(
          issue(
            "hidden-required-slot",
            "warning",
            `page:${pageId}:override:${targetId}`,
            targetId,
            { type: "show-template-layer", pageId, targetId },
          ),
        );
      }
    }
    for (const layer of page.extras) {
      const assetId = referencedAssetId(layer);
      if (assetId && !assetsById.has(assetId)) {
        issues.push(
          issue("missing-layer-asset", "blocking", `page:${pageId}:layer:${layer.id}`, assetId),
        );
      }
      issues.push(...boundsIssue(pageId, page.canvas.width, page.canvas.height, layer));
      issues.push(...auditTextLayerTokens(snapshot, pageId, layer));
    }
  }

  const severityOrder: Record<AuditSeverity, number> = { blocking: 0, warning: 1, info: 2 };
  issues.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.code.localeCompare(b.code) ||
      a.location.localeCompare(b.location),
  );
  return {
    issues,
    counts: {
      info: issues.filter((entry) => entry.severity === "info").length,
      warning: issues.filter((entry) => entry.severity === "warning").length,
      blocking: issues.filter((entry) => entry.severity === "blocking").length,
    },
  };
}
