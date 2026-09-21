import { CheckCircle2, RefreshCw, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { BrandSystemView } from "@/application/queries/brand-system-query";
import type { ProjectAuditView } from "@/application/queries/project-audit-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { Button } from "@/components/ui/button";
import type { AuditIssue, AuditIssueCode, AuditQuickFix } from "@/domain/audit/audit-engine";
import type { LogoVariant } from "@/domain/brand/brand-system";
import type { ProjectId } from "@/domain/project/hawya-project";
import {
  clearSpacePreview,
  INCORRECT_USAGE_CATALOG,
  type IncorrectUsageKind,
  type LogoGeometryInsight,
  logoGeometryInsightSchema,
} from "@/domain/smart/logo-analysis";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/types";

const ISSUE_KEYS: Record<AuditIssueCode, MessageKey> = {
  "missing-primary-logo": "audit.issue.missingPrimaryLogo",
  "missing-primary-color": "audit.issue.missingPrimaryColor",
  "missing-body-style": "audit.issue.missingBodyStyle",
  "unresolved-guide-page": "audit.issue.unresolvedGuidePage",
  "missing-binary": "audit.issue.missingBinary",
  "duplicate-source-hash": "audit.issue.duplicateSourceHash",
  "huge-asset": "audit.issue.hugeAsset",
  "unsanitized-svg": "audit.issue.unsanitizedSvg",
  "missing-logo-asset": "audit.issue.missingLogoAsset",
  "missing-font-asset": "audit.issue.missingFontAsset",
  "missing-layer-asset": "audit.issue.missingLayerAsset",
  "missing-color-token": "audit.issue.missingColorToken",
  "detached-color-token": "audit.issue.detachedColorToken",
  "stale-print-value": "audit.issue.stalePrintValue",
  "arabic-font-coverage": "audit.issue.arabicFontCoverage",
  "arabic-font-shaping-review": "audit.issue.arabicFontShapingReview",
  "invalid-local-override": "audit.issue.invalidLocalOverride",
  "layer-outside-page": "audit.issue.layerOutsidePage",
  "zero-layer-size": "audit.issue.zeroLayerSize",
  "hidden-required-slot": "audit.issue.hiddenRequiredSlot",
};

const QUICK_FIX_KEYS: Record<AuditQuickFix["type"], MessageKey> = {
  "use-color-token": "audit.fix.useToken",
  "fit-layer-to-page": "audit.fix.fitPage",
  "show-template-layer": "audit.fix.showLayer",
  "remove-local-override": "audit.fix.removeOverride",
};

const INCORRECT_KEYS: Record<IncorrectUsageKind, MessageKey> = {
  "stretch-horizontal": "audit.logo.dont.stretchHorizontal",
  "stretch-vertical": "audit.logo.dont.stretchVertical",
  rotate: "audit.logo.dont.rotate",
  "unapproved-color": "audit.logo.dont.unapprovedColor",
  "drop-shadow": "audit.logo.dont.dropShadow",
  "low-contrast-background": "audit.logo.dont.lowContrast",
  "crop-obstruct": "audit.logo.dont.cropObstruct",
  "alter-opacity": "audit.logo.dont.opacity",
};

function parseGeometry(variant: LogoVariant | undefined): LogoGeometryInsight | undefined {
  const parsed = logoGeometryInsightSchema.safeParse(variant?.geometry?.data);
  return parsed.success ? parsed.data : undefined;
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function minimumSizePayload(screen: string, print: string) {
  const screenPx = numberOrUndefined(screen);
  const printMm = numberOrUndefined(print);
  return {
    ...(screenPx === undefined ? {} : { screenPx }),
    ...(printMm === undefined ? {} : { printMm }),
  };
}

function severityIcon(issue: AuditIssue) {
  if (issue.severity === "blocking") return ShieldAlert;
  if (issue.severity === "warning") return TriangleAlert;
  return CheckCircle2;
}

export function AuditPanel({
  projectId,
  view,
  onRefresh,
}: {
  projectId: ProjectId;
  view: BrandSystemView;
  onRefresh: () => Promise<void>;
}) {
  const runtime = useStudioRuntime();
  const { t } = useI18n();
  const variants = view.snapshot.project.brand.logos.variants;
  const primaryId = view.snapshot.project.brand.logos.primaryLogoId;
  const [audit, setAudit] = useState<ProjectAuditView | null>(null);
  const [variantId, setVariantId] = useState(primaryId ?? variants[0]?.id ?? "");
  const [analysis, setAnalysis] = useState<LogoGeometryInsight | undefined>(() =>
    parseGeometry(variants.find((variant) => variant.id === (primaryId ?? variants[0]?.id))),
  );
  const [clearReference, setClearReference] = useState<
    "mark-height" | "custom-fraction" | "manual"
  >("mark-height");
  const [clearValue, setClearValue] = useState("0.5");
  const [clearUnit, setClearUnit] = useState<"ratio" | "px" | "mm">("ratio");
  const [screenPx, setScreenPx] = useState("");
  const [printMm, setPrintMm] = useState("");
  const [donts, setDonts] = useState<IncorrectUsageKind[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const confirmedClear = view.snapshot.project.brand.logos.rules.clearSpace?.source === "user";
  const confirmedMinimum = view.snapshot.project.brand.logos.rules.minimumSize?.source === "user";

  useEffect(() => {
    if (variantId && variants.some((variant) => variant.id === variantId)) return;
    setVariantId(primaryId ?? variants[0]?.id ?? "");
  }, [primaryId, variantId, variants]);

  useEffect(() => {
    setAnalysis(parseGeometry(selectedVariant));
  }, [selectedVariant]);

  const refreshAudit = useCallback(async () => {
    const next = await runtime.projectAudit.execute(projectId);
    setAudit(next ?? null);
  }, [projectId, runtime]);

  useEffect(() => {
    void refreshAudit().catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : t("common.unknownError")),
    );
  }, [refreshAudit, t]);

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      await onRefresh();
      await refreshAudit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    if (!variantId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runtime.logoSmartRules.analyze(projectId, variantId);
      setAnalysis(result);
      await onRefresh();
      await refreshAudit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const acceptedHexes = useMemo(
    () =>
      new Set(
        view.snapshot.project.brand.colors.tokens.map((token) => token.srgbHex.toUpperCase()),
      ),
    [view.snapshot.project.brand.colors.tokens],
  );

  const acceptPalette = (hex: string) =>
    run(() =>
      runtime.colorTokens.add(projectId, {
        name: { en: `Extracted ${hex}`, ar: `لون مستخرج ${hex}` },
        role: "supporting",
        srgbHex: hex,
      }),
    );

  const applyFix = (fix: AuditQuickFix) =>
    run(() => runtime.applyAuditQuickFix.execute(projectId, fix));

  const clearPreview = analysis
    ? clearSpacePreview(analysis, {
        reference: clearReference,
        value: numberOrUndefined(clearValue) ?? 0,
        unit: clearUnit,
      })
    : 0;

  return (
    <section className="brand-panel audit-panel" aria-labelledby="smart-audit-title">
      <div className="brand-panel__heading">
        <div>
          <p className="panel-kicker">{t("audit.kicker")}</p>
          <h2 id="smart-audit-title">{t("audit.title")}</h2>
          <p>{t("audit.body")}</p>
        </div>
        <Button variant="secondary" onClick={() => void refreshAudit()} disabled={busy}>
          <RefreshCw aria-hidden="true" size={15} />
          {t("audit.refresh")}
        </Button>
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <section className="audit-section" aria-labelledby="audit-logo-title">
        <div className="audit-section__heading">
          <div>
            <p className="panel-kicker">{t("audit.logo.kicker")}</p>
            <h3 id="audit-logo-title">{t("audit.logo.title")}</h3>
          </div>
          <span className="audit-boundary-note">{t("audit.logo.confirmationBoundary")}</span>
        </div>
        {variants.length === 0 ? (
          <div className="brand-empty">{t("audit.logo.empty")}</div>
        ) : (
          <>
            <div className="brand-form-grid">
              <label className="field-stack">
                <span className="field-label">{t("audit.logo.variant")}</span>
                <select
                  className="text-input"
                  value={variantId}
                  onChange={(event) => setVariantId(event.currentTarget.value)}
                >
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name.en ?? variant.name.ar ?? variant.role}
                    </option>
                  ))}
                </select>
              </label>
              <div className="brand-form-grid__action">
                <Button onClick={() => void analyze()} disabled={busy || !variantId}>
                  <Sparkles aria-hidden="true" size={15} />
                  {t("audit.logo.analyze")}
                </Button>
              </div>
            </div>

            {analysis ? (
              <div className="audit-logo-analysis" data-testid="logo-analysis">
                <div className="audit-metric-grid">
                  <div>
                    <span>{t("audit.logo.analysisKind")}</span>
                    <strong>{analysis.kind}</strong>
                  </div>
                  <div>
                    <span>{t("audit.logo.canvas")}</span>
                    <strong>
                      {Math.round(analysis.canvas.width)} × {Math.round(analysis.canvas.height)}
                    </strong>
                  </div>
                  <div>
                    <span>{t("audit.logo.aspect")}</span>
                    <strong>{analysis.aspectRatio.toFixed(3)}</strong>
                  </div>
                  <div>
                    <span>{t("audit.logo.padding")}</span>
                    <strong>
                      {Math.round(analysis.padding.top)} / {Math.round(analysis.padding.right)} /{" "}
                      {Math.round(analysis.padding.bottom)} / {Math.round(analysis.padding.left)}
                    </strong>
                  </div>
                </div>
                {analysis.cropSuggestion ? (
                  <p className="audit-inline-note" data-testid="crop-suggestion">
                    {t("audit.logo.cropSuggestion", {
                      x: Math.round(analysis.cropSuggestion.x * 100),
                      y: Math.round(analysis.cropSuggestion.y * 100),
                      width: Math.round(analysis.cropSuggestion.width * 100),
                      height: Math.round(analysis.cropSuggestion.height * 100),
                    })}
                  </p>
                ) : null}
                {analysis.paletteCandidates.length > 0 ? (
                  <div className="audit-palette">
                    <strong>{t("audit.logo.palette")}</strong>
                    <div className="audit-palette__items">
                      {analysis.paletteCandidates.map((hex) => (
                        <div className="audit-palette__item" key={hex}>
                          <span
                            className="audit-swatch"
                            style={{ background: hex }}
                            aria-hidden="true"
                          />
                          <code>{hex}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || acceptedHexes.has(hex)}
                            onClick={() => void acceptPalette(hex)}
                          >
                            {acceptedHexes.has(hex)
                              ? t("audit.logo.tokenAdded")
                              : t("audit.logo.addToken")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="audit-inline-note">{t("audit.logo.notAnalyzed")}</p>
            )}

            <div className="audit-rule-grid">
              <article className="audit-rule-card">
                <header>
                  <h4>{t("audit.logo.clearSpace")}</h4>
                  <span>{confirmedClear ? t("audit.confirmed") : t("audit.unconfirmed")}</span>
                </header>
                <label className="field-stack">
                  <span className="field-label">{t("audit.logo.reference")}</span>
                  <select
                    className="text-input"
                    value={clearReference}
                    onChange={(event) => {
                      const reference = event.currentTarget.value as typeof clearReference;
                      setClearReference(reference);
                      setClearUnit(reference === "manual" ? "px" : "ratio");
                    }}
                  >
                    <option value="mark-height">{t("audit.logo.referenceMark")}</option>
                    <option value="custom-fraction">{t("audit.logo.referenceFraction")}</option>
                    <option value="manual">{t("audit.logo.referenceManual")}</option>
                  </select>
                </label>
                <div className="audit-inline-fields">
                  <label className="field-stack">
                    <span className="field-label">{t("audit.logo.value")}</span>
                    <input
                      className="text-input"
                      inputMode="decimal"
                      value={clearValue}
                      onChange={(event) => setClearValue(event.currentTarget.value)}
                    />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">{t("audit.logo.unit")}</span>
                    <select
                      className="text-input"
                      value={clearUnit}
                      disabled={clearReference !== "manual"}
                      onChange={(event) =>
                        setClearUnit(event.currentTarget.value as typeof clearUnit)
                      }
                    >
                      {clearReference !== "manual" ? <option value="ratio">ratio</option> : null}
                      {clearReference === "manual" ? <option value="px">px</option> : null}
                      {clearReference === "manual" ? <option value="mm">mm</option> : null}
                    </select>
                  </label>
                </div>
                <p>{t("audit.logo.preview", { value: clearPreview.toFixed(2) })}</p>
                <Button
                  disabled={busy || !variantId}
                  onClick={() =>
                    void run(() =>
                      runtime.logoSmartRules.confirmClearSpace(projectId, variantId, {
                        reference: clearReference,
                        value: numberOrUndefined(clearValue) ?? 0,
                        unit: clearUnit,
                      }),
                    )
                  }
                >
                  {t("audit.logo.confirmRule")}
                </Button>
              </article>

              <article className="audit-rule-card">
                <header>
                  <h4>{t("audit.logo.minimumSize")}</h4>
                  <span>{confirmedMinimum ? t("audit.confirmed") : t("audit.unconfirmed")}</span>
                </header>
                <label className="field-stack">
                  <span className="field-label">{t("audit.logo.screenPx")}</span>
                  <input
                    className="text-input"
                    inputMode="decimal"
                    value={screenPx}
                    onChange={(event) => setScreenPx(event.currentTarget.value)}
                  />
                </label>
                <label className="field-stack">
                  <span className="field-label">{t("audit.logo.printMm")}</span>
                  <input
                    className="text-input"
                    inputMode="decimal"
                    value={printMm}
                    onChange={(event) => setPrintMm(event.currentTarget.value)}
                  />
                </label>
                <p>{t("audit.logo.minimumNote")}</p>
                <Button
                  disabled={busy || !variantId}
                  onClick={() =>
                    void run(() =>
                      runtime.logoSmartRules.confirmMinimumSize(
                        projectId,
                        variantId,
                        minimumSizePayload(screenPx, printMm),
                      ),
                    )
                  }
                >
                  {t("audit.logo.confirmRule")}
                </Button>
              </article>
            </div>

            <div className="audit-donts">
              <h4>{t("audit.logo.donts")}</h4>
              <p>{t("audit.logo.dontsBody")}</p>
              <div className="audit-check-grid">
                {INCORRECT_USAGE_CATALOG.map((kind) => (
                  <label key={kind} className="audit-check">
                    <input
                      type="checkbox"
                      checked={donts.includes(kind)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setDonts((current) =>
                          checked ? [...current, kind] : current.filter((item) => item !== kind),
                        );
                      }}
                    />
                    <span>{t(INCORRECT_KEYS[kind])}</span>
                  </label>
                ))}
              </div>
              <Button
                variant="secondary"
                disabled={busy || !variantId}
                onClick={() =>
                  void run(() =>
                    runtime.logoSmartRules.confirmIncorrectUsage(projectId, variantId, donts),
                  )
                }
              >
                {t("audit.logo.saveDonts")}
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="audit-section" aria-labelledby="audit-report-title">
        <div className="audit-section__heading">
          <div>
            <p className="panel-kicker">{t("audit.report.kicker")}</p>
            <h3 id="audit-report-title">{t("audit.report.title")}</h3>
          </div>
          {audit ? (
            <ul className="audit-counts" aria-label={t("audit.report.summary")}>
              <li data-severity="blocking">
                {t("audit.severity.blocking")}: {audit.report.counts.blocking}
              </li>
              <li data-severity="warning">
                {t("audit.severity.warning")}: {audit.report.counts.warning}
              </li>
              <li data-severity="info">
                {t("audit.severity.info")}: {audit.report.counts.info}
              </li>
            </ul>
          ) : null}
        </div>
        {!audit ? (
          <p>{t("common.loading")}</p>
        ) : audit.report.issues.length === 0 ? (
          <div className="brand-empty">{t("audit.report.clean")}</div>
        ) : (
          <div className="audit-issue-list">
            {audit.report.issues.map((entry) => {
              const Icon = severityIcon(entry);
              return (
                <article className="audit-issue" data-severity={entry.severity} key={entry.id}>
                  <Icon aria-hidden="true" size={18} />
                  <div>
                    <strong>{t(ISSUE_KEYS[entry.code])}</strong>
                    <p>{entry.detail ?? entry.location}</p>
                    <code>{entry.location}</code>
                  </div>
                  {entry.quickFix ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void applyFix(entry.quickFix as AuditQuickFix)}
                    >
                      {t(QUICK_FIX_KEYS[entry.quickFix.type])}
                    </Button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="audit-section" aria-labelledby="audit-contrast-title">
        <div className="audit-section__heading">
          <div>
            <p className="panel-kicker">{t("audit.contrast.kicker")}</p>
            <h3 id="audit-contrast-title">{t("audit.contrast.title")}</h3>
            <p>{t("audit.contrast.body")}</p>
          </div>
        </div>
        {audit?.contrasts.length ? (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>{t("audit.contrast.pair")}</th>
                  <th>{t("audit.contrast.ratio")}</th>
                  <th>AA</th>
                  <th>AAA</th>
                </tr>
              </thead>
              <tbody>
                {audit.contrasts.map((entry) => (
                  <tr key={`${entry.foregroundId}:${entry.backgroundId}`}>
                    <td>
                      <span className="audit-pair">
                        <i style={{ background: entry.foregroundHex }} />
                        <i style={{ background: entry.backgroundHex }} />
                        <span>
                          {entry.foregroundName} / {entry.backgroundName}
                        </span>
                      </span>
                    </td>
                    <td>
                      {entry.ratio.toFixed(2)}:1 <small>{entry.algorithm}</small>
                    </td>
                    <td>{entry.aaNormal ? t("audit.pass") : t("audit.fail")}</td>
                    <td>{entry.aaaNormal ? t("audit.pass") : t("audit.fail")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="brand-empty">{t("audit.contrast.empty")}</div>
        )}
      </section>

      <section className="audit-section" aria-labelledby="audit-font-title">
        <div className="audit-section__heading">
          <div>
            <p className="panel-kicker">{t("audit.fonts.kicker")}</p>
            <h3 id="audit-font-title">{t("audit.fonts.title")}</h3>
            <p>{t("audit.fonts.body")}</p>
          </div>
        </div>
        {audit?.fonts.length ? (
          <div className="font-grid">
            {audit.fonts.map((font) => (
              <article className="font-card" key={font.id}>
                <strong>{font.familyName}</strong>
                <p>
                  {font.arabicRatio === undefined
                    ? t("audit.fonts.noCoverage")
                    : t("audit.fonts.coverage", { percent: Math.round(font.arabicRatio * 100) })}
                </p>
                <p>
                  GSUB:{" "}
                  {font.hasGsub === undefined
                    ? "—"
                    : font.hasGsub
                      ? t("audit.detected")
                      : t("audit.notDetected")}{" "}
                  · GPOS:{" "}
                  {font.hasGpos === undefined
                    ? "—"
                    : font.hasGpos
                      ? t("audit.detected")
                      : t("audit.notDetected")}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="brand-empty">{t("audit.fonts.empty")}</div>
        )}
      </section>
    </section>
  );
}
