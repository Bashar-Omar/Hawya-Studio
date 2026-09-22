import { ArrowLeft, Download, ImagePlus, Save, Trash2, WandSparkles, X } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { MockupStudioView } from "@/application/queries/mockup-studio-query";
import type { MockupRenderProgress } from "@/application/ports/mockup-renderer";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { projectPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import type { NormalizedRect } from "@/domain/common/primitives";
import { localizedValue } from "@/domain/guide/page-content";
import {
  cloneDefaultMockupQuad,
  type MockupPreset,
  type MockupQuad,
  type MockupSurface,
} from "@/domain/mockup/mockup";
import type { ProjectId } from "@/domain/project/hawya-project";
import { createMockupFeatureRuntime } from "@/infrastructure/mockup/create-mockup-feature-runtime";
import { useI18n } from "@/i18n/I18nProvider";
import "@/features/mockup/mockup-studio.css";

type CornerKey = keyof MockupQuad;
type Axis = "x" | "y";

const CORNERS: CornerKey[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const CORNER_LABEL_KEYS = {
  topLeft: "mockup.corner.topLeft",
  topRight: "mockup.corner.topRight",
  bottomRight: "mockup.corner.bottomRight",
  bottomLeft: "mockup.corner.bottomLeft",
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function percent(value: number): number {
  return Math.round(value * 1000) / 10;
}

function cropValue(
  crop: NormalizedRect,
  key: keyof NormalizedRect,
  percentValue: number,
): NormalizedRect {
  const value = clamp(percentValue / 100, 0, 1);
  const next = { ...crop, [key]: value };
  if (key === "x") next.x = Math.min(next.x, 1 - next.width);
  if (key === "y") next.y = Math.min(next.y, 1 - next.height);
  if (key === "width") next.width = clamp(next.width, 0.01, 1 - next.x);
  if (key === "height") next.height = clamp(next.height, 0.01, 1 - next.y);
  return next;
}

function surfaceWithCorner(
  surface: MockupSurface,
  corner: CornerKey,
  axis: Axis,
  percentValue: number,
): MockupSurface {
  return {
    ...surface,
    corners: {
      ...surface.corners,
      [corner]: {
        ...surface.corners[corner],
        [axis]: clamp(percentValue / 100, 0, 1),
      },
    },
  };
}

function labelForPage(view: MockupStudioView, pageId: string, locale: "en" | "ar"): string {
  const page = view.snapshot.project.guide.pages[pageId];
  return page ? localizedValue(page.name, locale) : pageId;
}

function defaultSurface(
  view: MockupStudioView,
  backgroundAssetId: string,
): MockupSurface | undefined {
  const asset = view.artworkAssets.find((candidate) => candidate.id !== backgroundAssetId);
  if (asset) {
    return {
      corners: cloneDefaultMockupQuad(),
      artwork: { kind: "asset", assetId: asset.id },
      opacity: 1,
      blendMode: "normal",
      shadowStrength: 0.18,
      highlightStrength: 0.08,
    };
  }
  const pageId = view.pageIds[0];
  if (!pageId) return undefined;
  return {
    corners: cloneDefaultMockupQuad(),
    artwork: { kind: "page", pageId },
    opacity: 1,
    blendMode: "normal",
    shadowStrength: 0.18,
    highlightStrength: 0.08,
  };
}

function artworkValue(surface: MockupSurface): string {
  return surface.artwork.kind === "asset"
    ? `asset:${surface.artwork.assetId}`
    : `page:${surface.artwork.pageId}`;
}

export default function MockupStudioPage({ projectId }: { projectId: ProjectId }) {
  const runtime = useStudioRuntime();
  const feature = useMemo(() => createMockupFeatureRuntime(runtime), [runtime]);
  const { navigate } = useRouter();
  const { locale, t } = useI18n();
  const uploadRef = useRef<HTMLInputElement>(null);
  const renderController = useRef<AbortController | null>(null);
  const [view, setView] = useState<MockupStudioView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MockupPreset | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<MockupRenderProgress | null>(null);
  const [engine, setEngine] = useState<"webgl" | "canvas" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (preferredId?: string) => {
      const next = await runtime.mockupStudio.execute(projectId);
      if (!next) {
        navigate("/studio");
        return;
      }
      setView(next);
      const id = preferredId ?? next.snapshot.project.mockups.presets[0]?.id ?? null;
      setSelectedId(id);
      setDraft(
        id
          ? structuredClone(
              next.snapshot.project.mockups.presets.find((preset) => preset.id === id) ?? null,
            )
          : null,
      );
      setError(null);
    },
    [navigate, projectId, runtime],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      renderController.current?.abort();
      feature.dispose();
    },
    [feature],
  );

  useEffect(() => {
    let disposed = false;
    let url: string | null = null;
    const asset = view?.snapshot.assets.find(
      (candidate) => candidate.id === draft?.backgroundAssetId,
    );
    if (!asset) {
      setBackgroundUrl(null);
      return;
    }
    void runtime.binaries.get(asset.previewBinaryKey ?? asset.binaryKey).then((binary) => {
      if (!binary || disposed) return;
      url = URL.createObjectURL(new Blob([Uint8Array.from(binary.bytes)], { type: binary.mime }));
      setBackgroundUrl(url);
    });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft?.backgroundAssetId, runtime.binaries, view]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const selectPreset = (preset: MockupPreset) => {
    renderController.current?.abort();
    setSelectedId(preset.id);
    setDraft(structuredClone(preset));
    setProgress(null);
    setEngine(null);
    setError(null);
    setPreviewUrl(null);
  };

  const uploadBackground = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const source = await runtime.assetFiles.read(file, "mockup");
      const imported = await runtime.importAsset.execute(projectId, source);
      const preset = await runtime.mockupPresets.create(projectId, {
        name: file.name.replace(/\.[^.]+$/, "") || t("mockup.title"),
        backgroundAssetId: imported.asset.id,
      });
      await load(preset.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const savePreset = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await runtime.mockupPresets.update(projectId, draft.id, {
        name: draft.name,
        backgroundAssetId: draft.backgroundAssetId,
        crop: draft.crop,
        ...(draft.surface ? { surface: draft.surface } : {}),
      });
      await load(draft.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const deletePreset = async () => {
    if (!draft || !window.confirm(t("mockup.deleteConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      await runtime.mockupPresets.remove(projectId, draft.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const render = async (download: boolean) => {
    if (!draft || !view) return;
    renderController.current?.abort();
    const controller = new AbortController();
    renderController.current = controller;
    setBusy(true);
    setError(null);
    setProgress({ value: 0, stage: "decode" });
    try {
      const result = await feature.render(view.snapshot, draft, controller.signal, {
        maxDimension: download ? 4096 : 1600,
        onProgress: setProgress,
      });
      setEngine(result.engine);
      if (download) {
        feature.download(view.snapshot, draft, result);
      } else {
        const nextUrl = URL.createObjectURL(
          new Blob([Uint8Array.from(result.bytes)], { type: result.mime }),
        );
        setPreviewUrl(nextUrl);
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause.message : t("common.unknownError"));
      }
    } finally {
      if (renderController.current === controller) renderController.current = null;
      setBusy(false);
    }
  };

  const updateCornerFromPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
    corner: CornerKey,
  ) => {
    if (!draft?.surface) return;
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    setDraft({
      ...draft,
      surface: {
        ...draft.surface,
        corners: {
          ...draft.surface.corners,
          [corner]: { x, y },
        },
      },
    });
  };

  const railPanel = view ? (
    <div className="mockup-rail">
      <p className="panel-kicker">{t("mockup.presets")}</p>
      <h2>{view.snapshot.project.metadata.name}</h2>
      <div className="mockup-rail__list">
        {view.snapshot.project.mockups.presets.map((preset) => (
          <button
            type="button"
            className={`mockup-preset-link ${preset.id === selectedId ? "is-active" : ""}`}
            key={preset.id}
            onClick={() => selectPreset(preset)}
          >
            <span>{preset.name}</span>
            <small>{preset.surface ? t("mockup.smartBadge") : t("mockup.standardBadge")}</small>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  if (!view) {
    return (
      <AppShell title={t("mockup.title")} subtitle={t("mockup.subtitle")}>
        <div className="page-content">
          <p>{error ?? t("common.loading")}</p>
        </div>
      </AppShell>
    );
  }

  const artworkAssets = view.artworkAssets.filter((asset) => asset.id !== draft?.backgroundAssetId);
  const activeSurface = draft?.surface;

  const updateActiveSurface = (update: (surface: MockupSurface) => MockupSurface) => {
    setDraft((current) =>
      current?.surface ? { ...current, surface: update(current.surface) } : current,
    );
  };

  return (
    <AppShell
      title={view.snapshot.project.metadata.name}
      subtitle={t("mockup.subtitle")}
      railPanel={railPanel}
    >
      <div className="page-content page-content--wide mockup-studio">
        <header className="page-heading mockup-heading">
          <div>
            <p className="eyebrow">{t("mockup.kicker")}</p>
            <h1>{t("mockup.title")}</h1>
            <p>{t("mockup.body")}</p>
          </div>
          <div className="mockup-heading__actions">
            <Button onClick={() => uploadRef.current?.click()} disabled={busy}>
              <ImagePlus aria-hidden="true" size={16} />
              {t("mockup.upload")}
            </Button>
            <Button variant="ghost" onClick={() => navigate(projectPath(projectId))}>
              <ArrowLeft className="directional-icon" aria-hidden="true" size={16} />
              {t("mockup.back")}
            </Button>
            <input
              ref={uploadRef}
              className="sr-only"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadBackground(file);
              }}
            />
          </div>
        </header>

        <p className="field-help">{t("mockup.uploadHelp")}</p>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        {!draft ? (
          <section className="mockup-empty">
            <ImagePlus aria-hidden="true" size={30} />
            <h2>{t("mockup.empty")}</h2>
            <p>{t("mockup.emptyBody")}</p>
          </section>
        ) : (
          <div className="mockup-layout">
            <section className="mockup-preview-card" aria-label={t("mockup.preview")}>
              <div className="mockup-preview">
                {previewUrl || backgroundUrl ? (
                  <img
                    src={previewUrl ?? backgroundUrl ?? undefined}
                    alt={t("mockup.previewAlt")}
                    draggable={false}
                  />
                ) : (
                  <p>{t("mockup.assetMissing")}</p>
                )}
                {activeSurface
                  ? CORNERS.map((corner) => (
                      <button
                        type="button"
                        className="mockup-corner"
                        key={corner}
                        style={{
                          left: `${activeSurface.corners[corner].x * 100}%`,
                          top: `${activeSurface.corners[corner].y * 100}%`,
                        }}
                        aria-label={t(CORNER_LABEL_KEYS[corner])}
                        onPointerDown={(event) => {
                          event.currentTarget.setPointerCapture(event.pointerId);
                          updateCornerFromPointer(event, corner);
                        }}
                        onPointerMove={(event) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            updateCornerFromPointer(event, corner);
                          }
                        }}
                      />
                    ))
                  : null}
              </div>
              {!previewUrl ? <p className="field-help">{t("mockup.noPreview")}</p> : null}
              {progress ? (
                <p className="mockup-progress" role="status">
                  {t("mockup.progress", {
                    stage: progress.stage,
                    percent: Math.round(progress.value * 100),
                  })}
                </p>
              ) : null}
              {engine ? <p className="field-help">{t("mockup.engine", { engine })}</p> : null}
              <div className="mockup-actions">
                {busy && renderController.current ? (
                  <Button variant="secondary" onClick={() => renderController.current?.abort()}>
                    <X aria-hidden="true" size={16} />
                    {t("mockup.cancel")}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => void render(false)}
                      disabled={!feature.renderSupported || busy}
                    >
                      <WandSparkles aria-hidden="true" size={16} />
                      {t("mockup.preview")}
                    </Button>
                    <Button
                      onClick={() => void render(true)}
                      disabled={!feature.renderSupported || busy}
                    >
                      <Download aria-hidden="true" size={16} />
                      {t("mockup.download")}
                    </Button>
                  </>
                )}
              </div>
            </section>

            <section className="mockup-controls">
              <div className="mockup-control-card">
                <label className="field-stack">
                  <span className="field-label">{t("mockup.newName")}</span>
                  <input
                    className="text-input"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })}
                  />
                </label>
                <label className="field-stack">
                  <span className="field-label">{t("mockup.background")}</span>
                  <select
                    className="text-input"
                    value={draft.backgroundAssetId}
                    onChange={(event) =>
                      setDraft({ ...draft, backgroundAssetId: event.currentTarget.value })
                    }
                  >
                    {view.backgrounds.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="mockup-control-card">
                <legend>{t("mockup.crop")}</legend>
                <div className="mockup-grid">
                  {(
                    [
                      ["x", "mockup.cropX"],
                      ["y", "mockup.cropY"],
                      ["width", "mockup.cropWidth"],
                      ["height", "mockup.cropHeight"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="field-stack" key={key}>
                      <span className="field-label">{t(label)}</span>
                      <input
                        className="text-input"
                        type="number"
                        min={key === "width" || key === "height" ? 1 : 0}
                        max={100}
                        step="0.1"
                        value={percent(draft.crop[key])}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            crop: cropValue(draft.crop, key, Number(event.currentTarget.value)),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mockup-control-card">
                <legend>{t("mockup.smart")}</legend>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.surface)}
                    disabled={!feature.smartSupported}
                    onChange={(event) => {
                      if (!event.currentTarget.checked) {
                        const { surface: _surface, ...withoutSurface } = draft;
                        setDraft(withoutSurface);
                        return;
                      }
                      const surface = defaultSurface(view, draft.backgroundAssetId);
                      if (!surface) {
                        setError(t("mockup.emptyBody"));
                        return;
                      }
                      setDraft({ ...draft, surface });
                    }}
                  />
                  <span>
                    <strong>{t("mockup.smartEnable")}</strong>
                    <small>{t("mockup.smartExperimental")}</small>
                  </span>
                </label>
                {!feature.smartSupported ? (
                  <p className="mockup-capability-note">{t("mockup.smartUnsupported")}</p>
                ) : null}
                <p className="field-help">{t("mockup.smartScope")}</p>

                {activeSurface ? (
                  <div className="mockup-smart-controls">
                    <label className="field-stack">
                      <span className="field-label">{t("mockup.artwork")}</span>
                      <select
                        className="text-input"
                        value={artworkValue(activeSurface)}
                        onChange={(event) => {
                          const [kind, id] = event.currentTarget.value.split(":");
                          if (!id) return;
                          updateActiveSurface((surface) => ({
                            ...surface,
                            artwork:
                              kind === "page"
                                ? { kind: "page", pageId: id }
                                : { kind: "asset", assetId: id },
                          }));
                        }}
                      >
                        {artworkAssets.map((asset) => (
                          <option key={asset.id} value={`asset:${asset.id}`}>
                            {t("mockup.artworkAsset", { name: asset.name })}
                          </option>
                        ))}
                        {view.pageIds.map((pageId) => (
                          <option key={pageId} value={`page:${pageId}`}>
                            {t("mockup.artworkPage", {
                              name: labelForPage(view, pageId, locale),
                            })}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mockup-grid">
                      <label className="field-stack">
                        <span className="field-label">{t("mockup.opacity")}</span>
                        <input
                          className="text-input"
                          type="number"
                          min="0"
                          max="100"
                          value={Math.round(activeSurface.opacity * 100)}
                          onChange={(event) =>
                            updateActiveSurface((surface) => ({
                              ...surface,
                              opacity: clamp(Number(event.currentTarget.value) / 100, 0, 1),
                            }))
                          }
                        />
                      </label>
                      <label className="field-stack">
                        <span className="field-label">{t("mockup.blend")}</span>
                        <select
                          className="text-input"
                          value={activeSurface.blendMode}
                          onChange={(event) =>
                            updateActiveSurface((surface) => ({
                              ...surface,
                              blendMode: event.currentTarget.value as
                                | "normal"
                                | "multiply"
                                | "screen",
                            }))
                          }
                        >
                          <option value="normal">normal</option>
                          <option value="multiply">multiply</option>
                          <option value="screen">screen</option>
                        </select>
                      </label>
                      <label className="field-stack">
                        <span className="field-label">{t("mockup.shadow")}</span>
                        <input
                          className="text-input"
                          type="number"
                          min="0"
                          max="100"
                          value={Math.round(activeSurface.shadowStrength * 100)}
                          onChange={(event) =>
                            updateActiveSurface((surface) => ({
                              ...surface,
                              shadowStrength: clamp(Number(event.currentTarget.value) / 100, 0, 1),
                            }))
                          }
                        />
                      </label>
                      <label className="field-stack">
                        <span className="field-label">{t("mockup.highlight")}</span>
                        <input
                          className="text-input"
                          type="number"
                          min="0"
                          max="100"
                          value={Math.round(activeSurface.highlightStrength * 100)}
                          onChange={(event) =>
                            updateActiveSurface((surface) => ({
                              ...surface,
                              highlightStrength: clamp(
                                Number(event.currentTarget.value) / 100,
                                0,
                                1,
                              ),
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div>
                      <h3>{t("mockup.corners")}</h3>
                      <p className="field-help">{t("mockup.cornerHint")}</p>
                      <div className="mockup-corner-grid">
                        {CORNERS.map((corner) => (
                          <fieldset key={corner}>
                            <legend>{t(CORNER_LABEL_KEYS[corner])}</legend>
                            {(["x", "y"] as const).map((axis) => (
                              <label className="field-stack" key={axis}>
                                <span className="field-label">{axis.toUpperCase()} %</span>
                                <input
                                  className="text-input"
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={percent(activeSurface.corners[corner][axis])}
                                  onChange={(event) =>
                                    updateActiveSurface((surface) =>
                                      surfaceWithCorner(
                                        surface,
                                        corner,
                                        axis,
                                        Number(event.currentTarget.value),
                                      ),
                                    )
                                  }
                                />
                              </label>
                            ))}
                          </fieldset>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </fieldset>

              <div className="mockup-form-actions">
                <Button variant="ghost" onClick={() => void deletePreset()} disabled={busy}>
                  <Trash2 aria-hidden="true" size={16} />
                  {t("mockup.delete")}
                </Button>
                <Button onClick={() => void savePreset()} disabled={busy || !draft.name.trim()}>
                  <Save aria-hidden="true" size={16} />
                  {t("mockup.save")}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
