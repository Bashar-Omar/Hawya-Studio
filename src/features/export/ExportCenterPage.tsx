import { ArrowLeft, Download, Printer, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ExportWorkspace } from "@/application/queries/export-workspace-query";
import { inferGuideLocaleMode } from "@/application/queries/guide-studio-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { printPath, projectPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { useAnnounce } from "@/components/app/LiveRegion";
import { Button } from "@/components/ui/button";
import {
  EXPORT_FIDELITY_CONTRACTS,
  type ExportFormat,
  type FontInclusionPolicy,
} from "@/domain/export/export-contract";
import { rasterPixelDimensions } from "@/domain/export/raster-dimensions";
import { localizedValue } from "@/domain/guide/page-content";
import type { ProjectId } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import {
  createExportFeatureRuntime,
  type ExportFeatureRuntime,
  type ExportRequest,
} from "@/infrastructure/export/create-export-feature-runtime";
import {
  DEFAULT_DELIVERY_SELECTION,
  type DeliverySelection,
} from "@/infrastructure/export/package-export-renderers";
import { useI18n } from "@/i18n/I18nProvider";
import "@/features/export/export.css";

const FORMAT_GROUPS = [
  { key: "documents", formats: ["hawya", "print"] },
  {
    key: "artwork",
    formats: ["svg-editable", "svg-outlined", "png", "webp", "jpeg"],
  },
  { key: "web", formats: ["web-guide"] },
  {
    key: "developer",
    formats: ["tokens-json", "css-variables", "brand-guidelines"],
  },
  { key: "delivery", formats: ["delivery"] },
] as const satisfies ReadonlyArray<{
  key: "documents" | "artwork" | "web" | "developer" | "delivery";
  formats: readonly ExportFormat[];
}>;

const CATEGORY_MESSAGE_KEYS = {
  documents: "export.category.documents",
  artwork: "export.category.artwork",
  web: "export.category.web",
  developer: "export.category.developer",
  delivery: "export.category.delivery",
} as const;

const FORMAT_LABELS: Record<ExportFormat, string> = {
  hawya: ".hawya Project Backup",
  "svg-editable": "Editable SVG",
  "svg-outlined": "Outlined SVG",
  png: "PNG",
  webp: "WebP",
  jpeg: "JPEG",
  print: "Browser Print / PDF",
  "tokens-json": "Design Tokens JSON",
  "css-variables": "CSS Variables",
  "brand-guidelines": "brand-guidelines.md",
  "web-guide": "Static Web Guide ZIP",
  delivery: "Delivery ZIP",
};

const PAGE_FORMATS = new Set<ExportFormat>(["svg-editable", "svg-outlined", "png", "webp", "jpeg"]);

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isPackageFormat(format: ExportFormat): format is "web-guide" | "delivery" {
  return format === "web-guide" || format === "delivery";
}

export default function ExportCenterPage({ projectId }: { projectId: ProjectId }) {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { locale, t } = useI18n();
  const announce = useAnnounce();
  const featureRef = useRef<ExportFeatureRuntime | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [workspace, setWorkspace] = useState<ExportWorkspace | null>(null);
  const [format, setFormat] = useState<ExportFormat>("hawya");
  const [localeMode, setLocaleMode] = useState<TemplateLocaleMode>("en");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [scalePreset, setScalePreset] = useState<"1" | "2" | "3" | "custom">("2");
  const [customScale, setCustomScale] = useState(4);
  const [quality, setQuality] = useState(0.92);
  const [flattenBackground, setFlattenBackground] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [fontPolicy, setFontPolicy] = useState<FontInclusionPolicy | "">("");
  const [deliverySelection, setDeliverySelection] = useState<DeliverySelection>({
    ...DEFAULT_DELIVERY_SELECTION,
  });
  const [warningsAccepted, setWarningsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const feature = createExportFeatureRuntime(runtime);
    featureRef.current = feature;
    let active = true;

    void feature.workspace
      .execute(projectId)
      .then((next) => {
        if (!active) return;
        if (!next) {
          navigate("/studio");
          return;
        }
        setWorkspace(next);
        setLocaleMode(inferGuideLocaleMode(next.snapshot));
        setSelectedPages([...next.snapshot.project.guide.pageOrder]);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : t("common.unknownError"));
        }
      });

    return () => {
      active = false;
      abortRef.current?.abort();
      feature.dispose();
      featureRef.current = null;
    };
  }, [navigate, projectId, runtime, t]);

  const preflight = useMemo(() => {
    if (!workspace) return null;
    const policy = isPackageFormat(format) && fontPolicy ? fontPolicy : undefined;
    return workspace.preflight(format, policy);
  }, [fontPolicy, format, workspace]);

  const availableLocaleModes = useMemo<TemplateLocaleMode[]>(() => {
    if (!workspace) return ["en"];
    const locales = workspace.snapshot.project.settings.enabledContentLocales;
    return locales.includes("en") && locales.includes("ar")
      ? ["en", "ar", "bilingual"]
      : [workspace.snapshot.project.settings.defaultContentLocale];
  }, [workspace]);

  const sourceSize = useMemo(() => {
    if (!workspace) return 0;
    const refs = new Set(
      workspace.snapshot.project.assetRefs.map((reference) => reference.assetId),
    );
    return workspace.snapshot.assets
      .filter((asset) => refs.has(asset.id))
      .reduce((sum, asset) => sum + asset.byteLength, 0);
  }, [workspace]);

  const rasterScale = scalePreset === "custom" ? customScale : Number(scalePreset);
  const rasterTargets = useMemo(() => {
    if (!workspace || !["png", "webp", "jpeg"].includes(format)) return [];
    return selectedPages.flatMap((pageId) => {
      const page = workspace.snapshot.project.guide.pages[pageId];
      if (!page) return [];
      const dimensions = rasterPixelDimensions(
        page.canvas.width,
        page.canvas.height,
        page.canvas.unit,
        rasterScale,
      );
      return [{ pageId, page, dimensions }];
    });
  }, [format, rasterScale, selectedPages, workspace]);
  const rasterScaleValid = Number.isFinite(rasterScale) && rasterScale >= 0.25 && rasterScale <= 8;
  const rasterWithinSafetyCap = rasterTargets.every(
    (target) => target.dimensions.pixels <= 100_000_000,
  );

  const pageSelectionRequired = PAGE_FORMATS.has(format);
  const selectionValid = !pageSelectionRequired || selectedPages.length > 0;
  const warningsNeedAcceptance = (preflight?.counts.warning ?? 0) > 0;
  const isRasterFormat = format === "png" || format === "webp" || format === "jpeg";
  const rasterOptionsValid = !isRasterFormat || (rasterScaleValid && rasterWithinSafetyCap);
  const deliverySelectionValid =
    format !== "delivery" || Object.values(deliverySelection).some(Boolean);
  const canRun =
    Boolean(
      workspace && preflight?.ok && selectionValid && rasterOptionsValid && deliverySelectionValid,
    ) &&
    (!warningsNeedAcceptance || warningsAccepted) &&
    !busy;

  const buildRequest = (): ExportRequest => {
    if (format === "hawya") return { format, localeMode };
    if (format === "svg-editable" || format === "svg-outlined") {
      return { format, localeMode, pageIds: selectedPages };
    }
    if (format === "png" || format === "webp" || format === "jpeg") {
      return {
        format,
        localeMode,
        scale: rasterScale,
        quality,
        ...(format === "jpeg" || flattenBackground ? { background: backgroundColor } : {}),
        pageIds: selectedPages,
      };
    }
    if (format === "tokens-json" || format === "css-variables" || format === "brand-guidelines") {
      return { format, localeMode };
    }
    if (format === "web-guide") {
      if (!fontPolicy) throw new Error(t("export.fontPolicyRequired"));
      return { format, localeMode, fontPolicy };
    }
    if (format === "delivery") {
      if (!fontPolicy) throw new Error(t("export.fontPolicyRequired"));
      return {
        format,
        localeMode,
        fontPolicy,
        include: deliverySelection,
      };
    }
    throw new Error("Print is opened through the dedicated Print View");
  };

  const runExport = async () => {
    const feature = featureRef.current;
    if (!workspace || !preflight?.ok || !feature) return;

    if (format === "print") {
      navigate(printPath(projectId));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setStatus(t("export.status.preparing"));

    try {
      const artifacts = await feature.execute(workspace, buildRequest(), controller.signal);
      if (controller.signal.aborted) return;
      setStatus(t("export.status.downloading"));
      for (const artifact of artifacts) feature.files.download(artifact);
      setStatus(t("export.status.complete"));
      announce(t("export.status.complete"));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setStatus(t("export.status.cancelled"));
      } else {
        setError(cause instanceof Error ? cause.message : t("common.unknownError"));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  if (!workspace) {
    return (
      <AppShell title={t("export.title")} subtitle={t("export.subtitle")}>
        <div className="page-content">
          <p>{error ?? t("common.loading")}</p>
        </div>
      </AppShell>
    );
  }

  const snapshot = workspace.snapshot;
  const fidelity = EXPORT_FIDELITY_CONTRACTS[format];

  return (
    <AppShell title={snapshot.project.metadata.name} subtitle={t("export.subtitle")}>
      <div className="page-content page-content--wide export-center">
        <header className="page-heading export-center__heading">
          <div>
            <p className="eyebrow">{t("export.kicker")}</p>
            <h1>{t("export.title")}</h1>
            <p>{t("export.body")}</p>
          </div>
          <Button variant="ghost" onClick={() => navigate(projectPath(projectId))}>
            <ArrowLeft className="directional-icon" aria-hidden="true" size={16} />
            {t("export.back")}
          </Button>
        </header>

        <div className="export-center__layout">
          <aside className="export-format-panel" aria-label={t("export.formats")}>
            {FORMAT_GROUPS.map((group) => (
              <section key={group.key} className="export-format-group">
                <h2>{t(CATEGORY_MESSAGE_KEYS[group.key])}</h2>
                <div className="export-format-list">
                  {group.formats.map((item) => (
                    <button
                      type="button"
                      className={item === format ? "export-format is-active" : "export-format"}
                      key={item}
                      onClick={() => {
                        setFormat(item);
                        setWarningsAccepted(false);
                        setStatus(null);
                        setError(null);
                      }}
                      aria-pressed={item === format}
                    >
                      <strong>{FORMAT_LABELS[item]}</strong>
                      <span>
                        {EXPORT_FIDELITY_CONTRACTS[item].vector
                          ? t("export.fidelity.vector")
                          : t("export.fidelity.dataOrRaster")}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </aside>

          <main className="export-config">
            <section className="export-card">
              <div className="export-card__title">
                <div>
                  <p className="eyebrow">{t("export.selected")}</p>
                  <h2>{FORMAT_LABELS[format]}</h2>
                </div>
                <fieldset className="export-fidelity-chips">
                  <legend className="sr-only">{t("export.fidelity.title")}</legend>
                  <span>
                    {fidelity.editable ? t("export.fidelity.editable") : t("export.fidelity.fixed")}
                  </span>
                  <span>
                    {fidelity.vector
                      ? t("export.fidelity.vector")
                      : t("export.fidelity.dataOrRaster")}
                  </span>
                  {fidelity.requiresFonts ? <span>{t("export.fidelity.fonts")}</span> : null}
                </fieldset>
              </div>

              <p>{fidelity.description}</p>
              {fidelity.limitation ? (
                <p className="export-limitation">{fidelity.limitation}</p>
              ) : null}

              <div className="export-option-grid">
                <label className="field-stack">
                  <span className="field-label">{t("export.localeMode")}</span>
                  <select
                    className="text-input"
                    value={localeMode}
                    onChange={(event) =>
                      setLocaleMode(event.currentTarget.value as TemplateLocaleMode)
                    }
                  >
                    {availableLocaleModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="export-estimate">
                  <span>{t("export.sourceSize")}</span>
                  <strong>{formatBytes(sourceSize)}</strong>
                </div>
              </div>

              {PAGE_FORMATS.has(format) ? (
                <fieldset className="export-pages">
                  <legend>{t("export.pages")}</legend>
                  <label className="export-page-choice export-page-choice--all">
                    <input
                      type="checkbox"
                      checked={
                        selectedPages.length === snapshot.project.guide.pageOrder.length &&
                        snapshot.project.guide.pageOrder.length > 0
                      }
                      onChange={(event) =>
                        setSelectedPages(
                          event.currentTarget.checked ? [...snapshot.project.guide.pageOrder] : [],
                        )
                      }
                    />
                    <span>{t("export.pagesAll")}</span>
                  </label>
                  <div className="export-pages__grid">
                    {snapshot.project.guide.pageOrder.map((pageId) => {
                      const page = snapshot.project.guide.pages[pageId];
                      if (!page) return null;
                      return (
                        <label className="export-page-choice" key={pageId}>
                          <input
                            type="checkbox"
                            checked={selectedPages.includes(pageId)}
                            onChange={(event) =>
                              setSelectedPages((current) =>
                                event.currentTarget.checked
                                  ? [...current, pageId]
                                  : current.filter((id) => id !== pageId),
                              )
                            }
                          />
                          <span>{localizedValue(page.name, locale)}</span>
                        </label>
                      );
                    })}
                  </div>
                  {!selectionValid ? (
                    <p className="inline-error">{t("export.pagesRequired")}</p>
                  ) : null}
                </fieldset>
              ) : null}

              {isRasterFormat ? (
                <div className="export-raster-options">
                  <div className="export-option-grid">
                    <label className="field-stack">
                      <span className="field-label">{t("export.scale")}</span>
                      <select
                        className="text-input"
                        value={scalePreset}
                        onChange={(event) =>
                          setScalePreset(event.currentTarget.value as "1" | "2" | "3" | "custom")
                        }
                      >
                        <option value="1">1×</option>
                        <option value="2">2×</option>
                        <option value="3">3×</option>
                        <option value="custom">{t("export.scaleCustom")}</option>
                      </select>
                    </label>
                    {scalePreset === "custom" ? (
                      <label className="field-stack">
                        <span className="field-label">{t("export.scaleCustomValue")}</span>
                        <input
                          className="text-input"
                          type="number"
                          min="0.25"
                          max="8"
                          step="0.25"
                          value={customScale}
                          onChange={(event) => setCustomScale(Number(event.currentTarget.value))}
                        />
                      </label>
                    ) : format !== "png" ? (
                      <label className="field-stack">
                        <span className="field-label">
                          {t("export.quality")} · {Math.round(quality * 100)}%
                        </span>
                        <input
                          type="range"
                          min="0.5"
                          max="1"
                          step="0.01"
                          value={quality}
                          onChange={(event) => setQuality(Number(event.currentTarget.value))}
                        />
                      </label>
                    ) : null}
                  </div>

                  {scalePreset === "custom" && format !== "png" ? (
                    <label className="field-stack export-quality-full">
                      <span className="field-label">
                        {t("export.quality")} · {Math.round(quality * 100)}%
                      </span>
                      <input
                        type="range"
                        min="0.5"
                        max="1"
                        step="0.01"
                        value={quality}
                        onChange={(event) => setQuality(Number(event.currentTarget.value))}
                      />
                    </label>
                  ) : null}

                  <fieldset className="export-raster-background">
                    <legend>{t("export.background")}</legend>
                    <label>
                      <input
                        type="checkbox"
                        checked={format === "jpeg" || flattenBackground}
                        disabled={format === "jpeg"}
                        onChange={(event) => setFlattenBackground(event.currentTarget.checked)}
                      />
                      <span>
                        {format === "jpeg"
                          ? t("export.backgroundJpegRequired")
                          : t("export.backgroundFlatten")}
                      </span>
                    </label>
                    {format === "jpeg" || flattenBackground ? (
                      <label className="field-stack">
                        <span className="field-label">{t("export.backgroundColor")}</span>
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(event) => setBackgroundColor(event.currentTarget.value)}
                        />
                      </label>
                    ) : null}
                  </fieldset>

                  <div className="export-pixel-preview">
                    <strong>{t("export.pixelPreview")}</strong>
                    {rasterScaleValid ? (
                      <ul>
                        {rasterTargets.map(({ pageId, page, dimensions }) => (
                          <li key={pageId}>
                            <span>{localizedValue(page.name, locale)}</span>
                            <code>
                              {dimensions.width} × {dimensions.height} px
                            </code>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="inline-error">{t("export.scaleInvalid")}</p>
                    )}
                    {!rasterWithinSafetyCap ? (
                      <p className="inline-error">{t("export.rasterTooLarge")}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {format === "delivery" ? (
                <fieldset className="export-delivery-tree">
                  <legend>{t("export.deliveryContents")}</legend>
                  <p>{t("export.deliveryContentsBody")}</p>
                  {(
                    [
                      ["guidelines", "export.delivery.guidelines"],
                      ["artwork", "export.delivery.artwork"],
                      ["logos", "export.delivery.logos"],
                      ["colors", "export.delivery.colors"],
                      ["digital", "export.delivery.digital"],
                      ["fonts", "export.delivery.fonts"],
                      ["sourceAttachments", "export.delivery.sourceAttachments"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={deliverySelection[key]}
                        onChange={(event) =>
                          setDeliverySelection((current) => ({
                            ...current,
                            [key]: event.currentTarget.checked,
                          }))
                        }
                      />
                      <span>{t(label)}</span>
                    </label>
                  ))}
                  {!deliverySelectionValid ? (
                    <p className="inline-error">{t("export.deliveryRequired")}</p>
                  ) : null}
                  {deliverySelection.fonts && fontPolicy !== "include-confirmed" ? (
                    <p className="export-delivery-note">{t("export.deliveryFontsPolicy")}</p>
                  ) : null}
                </fieldset>
              ) : null}

              {isPackageFormat(format) ? (
                <fieldset className="export-font-policy">
                  <legend>{t("export.fontPolicy")}</legend>
                  <p>{t("export.fontPolicyBody")}</p>
                  <label>
                    <input
                      type="radio"
                      name="font-policy"
                      checked={fontPolicy === "omit"}
                      onChange={() => {
                        setFontPolicy("omit");
                        setWarningsAccepted(false);
                        setStatus(null);
                        setError(null);
                      }}
                    />
                    <span>{t("export.fontPolicyOmit")}</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="font-policy"
                      checked={fontPolicy === "include-confirmed"}
                      onChange={() => {
                        setFontPolicy("include-confirmed");
                        setWarningsAccepted(false);
                        setStatus(null);
                        setError(null);
                      }}
                    />
                    <span>{t("export.fontPolicyInclude")}</span>
                  </label>
                </fieldset>
              ) : null}
            </section>

            <section
              className="export-card export-preflight"
              aria-labelledby="export-preflight-title"
            >
              <div className="export-card__title">
                <div>
                  <p className="eyebrow">{t("export.preflightKicker")}</p>
                  <h2 id="export-preflight-title">{t("export.preflight")}</h2>
                </div>
                <div className="export-preflight__counts">
                  <span>
                    {t("export.blockingCount", { count: preflight?.counts.blocking ?? 0 })}
                  </span>
                  <span>{t("export.warningCount", { count: preflight?.counts.warning ?? 0 })}</span>
                </div>
              </div>

              {preflight?.issues.length ? (
                <ul className="export-preflight__issues">
                  {preflight.issues.map((issue) => (
                    <li
                      key={`${issue.code}:${issue.location}:${issue.detail ?? ""}`}
                      data-severity={issue.severity}
                    >
                      <strong>
                        {issue.severity === "blocking"
                          ? t("audit.severity.blocking")
                          : t("audit.severity.warning")}
                      </strong>
                      <span>{issue.detail ?? issue.code}</span>
                      <code>{issue.location}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="export-preflight__clean">{t("export.preflightClean")}</p>
              )}

              {warningsNeedAcceptance && preflight?.ok ? (
                <label className="export-warning-ack">
                  <input
                    type="checkbox"
                    checked={warningsAccepted}
                    onChange={(event) => setWarningsAccepted(event.currentTarget.checked)}
                  />
                  <span>{t("export.warningAcknowledge")}</span>
                </label>
              ) : null}
            </section>

            {error ? (
              <div className="error-banner" role="alert">
                {error}
              </div>
            ) : null}
            {status ? (
              <p className="export-status" role="status">
                {status}
              </p>
            ) : null}

            <div className="export-actions">
              {busy ? (
                <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
                  <X aria-hidden="true" size={16} />
                  {t("export.cancel")}
                </Button>
              ) : null}
              <Button onClick={() => void runExport()} disabled={!canRun}>
                {format === "print" ? (
                  <Printer aria-hidden="true" size={16} />
                ) : (
                  <Download aria-hidden="true" size={16} />
                )}
                {format === "print" ? t("export.openPrint") : t("export.download")}
              </Button>
            </div>
          </main>
        </div>
      </div>
    </AppShell>
  );
}
