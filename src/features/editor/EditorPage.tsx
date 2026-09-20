import { ArrowLeft, Save, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EditorSession } from "@/application/editor/editor-session";
import { inferGuideLocaleMode } from "@/application/queries/guide-studio-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { projectPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import type { PageId } from "@/domain/guide/guide-document";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import {
  alignTransforms,
  distributeTransforms,
  documentUnitScale,
  type AlignmentCommand,
  type DistributionCommand,
} from "@/editor/geometry/geometry";
import { resolveRenderedScene } from "@/editor/scene/scene-resolver";
import type {
  EditorClipboardPayload,
  EditorSnapGuide,
  EditorTool,
  EditorViewportState,
  LayerTransform,
  SceneLayerId,
} from "@/editor/model/editor-types";
import { useI18n } from "@/i18n/I18nProvider";
import { EditorCanvas } from "@/features/editor/EditorCanvas";
import { EditorInspector } from "@/features/editor/EditorInspector";
import { EditorLayerTree } from "@/features/editor/EditorLayerTree";
import { EditorToolbar } from "@/features/editor/EditorToolbar";
import { ShortcutsDialog } from "@/features/editor/ShortcutsDialog";
import "@/features/editor/editor.css";

const CLIPBOARD_MIME = "application/x-hawya-layer+json";

function clampZoom(zoom: number) {
  return Math.min(4, Math.max(0.1, zoom));
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export default function EditorPage({
  projectId,
  pageId,
}: {
  projectId: ProjectId;
  pageId: PageId;
}) {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<EditorSession | null>(null);
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [selection, setSelection] = useState<SceneLayerId[]>([]);
  const [primaryId, setPrimaryId] = useState<SceneLayerId | undefined>();
  const [viewport, setViewport] = useState<EditorViewportState>({ zoom: 0.75, panX: 72, panY: 56 });
  const [transient, setTransient] = useState<ReadonlyMap<SceneLayerId, LayerTransform>>(new Map());
  const [snapGuides, setSnapGuides] = useState<EditorSnapGuide[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const [altDown, setAltDown] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fallbackClipboard = useRef<EditorClipboardPayload | undefined>();

  const sync = useCallback((active: EditorSession) => {
    setSnapshot(active.projectSnapshot());
    setTransient(new Map(active.transient()));
  }, []);

  useEffect(() => {
    let active = true;
    void runtime.editorSessions
      .open(projectId, pageId)
      .then((opened) => {
        if (!active) return;
        setSession(opened);
        setSnapshot(opened.projectSnapshot());
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : t("common.unknownError"));
      });
    return () => {
      active = false;
    };
  }, [pageId, projectId, runtime, t]);

  const page = session?.page();
  const localeMode = snapshot ? inferGuideLocaleMode(snapshot) : "en";
  const scene = useMemo(
    () => (snapshot && page ? resolveRenderedScene(snapshot, page, localeMode) : undefined),
    [localeMode, page, snapshot],
  );
  const layerMap = useMemo(
    () => new Map(scene?.layers.map((layer) => [layer.id, layer] as const) ?? []),
    [scene],
  );
  const primaryLayer = primaryId ? layerMap.get(primaryId) : undefined;
  const selectedLayers = useMemo(
    () =>
      selection.flatMap((id) => {
        const layer = layerMap.get(id);
        return layer ? [layer] : [];
      }),
    [layerMap, selection],
  );
  const unlockedSelected = useMemo(
    () => selectedLayers.filter((layer) => !layer.locked),
    [selectedLayers],
  );
  const history = session?.historyState();

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    const urls: string[] = [];
    const load = async () => {
      const entries: Array<[string, string]> = [];
      for (const asset of snapshot.assets) {
        if (!["image", "vector", "logo", "icon", "illustration"].includes(asset.kind)) continue;
        const binary = await runtime.binaries.get(asset.previewBinaryKey ?? asset.binaryKey);
        if (!binary) continue;
        const url = URL.createObjectURL(
          new Blob([Uint8Array.from(binary.bytes)], { type: binary.mime }),
        );
        urls.push(url);
        entries.push([asset.id, url]);
      }
      if (!cancelled) setAssetUrls(Object.fromEntries(entries));
    };
    void load();
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [runtime, snapshot]);

  const run = useCallback(
    async (operation: (active: EditorSession) => Promise<unknown>) => {
      if (!session || busy) return;
      setBusy(true);
      setError(null);
      try {
        await operation(session);
        sync(session);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t("common.unknownError"));
      } finally {
        setBusy(false);
      }
    },
    [busy, session, sync, t],
  );

  const setSelectionState = useCallback((ids: SceneLayerId[], primary?: SceneLayerId) => {
    setSelection(ids);
    setPrimaryId(primary);
  }, []);

  const centerPoint = useCallback(() => {
    if (!page) return { x: 80, y: 80 };
    return {
      x: Math.max(24, page.canvas.width / 2 - 100),
      y: Math.max(24, page.canvas.height / 2 - 50),
    };
  }, [page]);

  const addText = useCallback(() => {
    const point = centerPoint();
    void run(async (active) => {
      const id = await active.addText(
        point.x,
        point.y,
        localeMode === "ar" ? "نص عربي" : "Text",
        localeMode === "ar"
          ? { language: "ar", direction: "rtl" }
          : localeMode === "en"
            ? { language: "en", direction: "ltr" }
            : { direction: "auto" },
      );
      setSelectionState([id], id);
      setTool("select");
    });
  }, [centerPoint, localeMode, run, setSelectionState]);

  const addShape = useCallback(() => {
    const point = centerPoint();
    void run(async (active) => {
      const id = await active.addShape(point.x, point.y);
      setSelectionState([id], id);
      setTool("select");
    });
  }, [centerPoint, run, setSelectionState]);

  const placeableAsset = useMemo(
    () =>
      snapshot?.assets.find((asset) =>
        ["image", "vector", "logo", "icon", "illustration"].includes(asset.kind),
      ),
    [snapshot],
  );
  const addAsset = useCallback(() => {
    if (!placeableAsset) return;
    const point = centerPoint();
    void run(async (active) => {
      const kind = placeableAsset.kind === "image" ? "image" : "vector";
      const id = await active.addAsset(placeableAsset.id, kind, point.x, point.y);
      setSelectionState([id], id);
      setTool("select");
    });
  }, [centerPoint, placeableAsset, run, setSelectionState]);

  const fitPage = useCallback(() => {
    if (!page) return;
    const scale = documentUnitScale(page.canvas.unit);
    const availableWidth = Math.max(360, window.innerWidth - 500);
    const availableHeight = Math.max(280, window.innerHeight - 210);
    const zoom = clampZoom(
      Math.min(
        availableWidth / (page.canvas.width * scale),
        availableHeight / (page.canvas.height * scale),
      ) * 0.9,
    );
    setViewport({ zoom, panX: 36, panY: 36 });
  }, [page]);

  const duplicate = useCallback(() => {
    if (!selection.length) return;
    void run(async (active) => {
      const ids = await active.duplicate(selection);
      if (ids.length) setSelectionState(ids, ids.at(-1));
    });
  }, [run, selection, setSelectionState]);

  const deleteSelected = useCallback(() => {
    const ids = unlockedSelected.map((layer) => layer.id);
    if (!ids.length) return;
    void run(async (active) => {
      await active.delete(ids);
      setSelectionState([], undefined);
    });
  }, [run, setSelectionState, unlockedSelected]);

  const group = useCallback(() => {
    const ids = unlockedSelected
      .filter((layer) => layer.source === "extra" && !layer.parentGroupId)
      .map((layer) => layer.id);
    if (ids.length < 2) return;
    void run(async (active) => {
      const id = await active.group(ids);
      if (id) setSelectionState([id], id);
    });
  }, [run, setSelectionState, unlockedSelected]);

  const ungroup = useCallback(() => {
    if (primaryLayer?.type !== "group" || primaryLayer.source !== "extra") return;
    void run(async (active) => {
      const ids = await active.ungroup(primaryLayer.id);
      setSelectionState(ids, ids.at(-1));
    });
  }, [primaryLayer, run, setSelectionState]);

  const align = (command: AlignmentCommand) => {
    if (unlockedSelected.length < 2) return;
    const transforms = alignTransforms(unlockedSelected, command);
    void run((active) => active.setTransforms(`Align ${command}`, transforms));
  };

  const distribute = (command: DistributionCommand) => {
    if (unlockedSelected.length < 3) return;
    if (unlockedSelected.some((layer) => Math.abs(layer.transform.rotation) > 0.001)) {
      setError(t("editor.distributionRotation"));
      return;
    }
    const transforms = distributeTransforms(unlockedSelected, command);
    void run((active) => active.setTransforms(`Distribute ${command}`, transforms));
  };

  const copy = useCallback(async () => {
    if (!session) return;
    const payload = session.clipboardPayload(selection);
    if (!payload) return;
    fallbackClipboard.current = payload;
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        const json = JSON.stringify(payload);
        await navigator.clipboard.write([
          new ClipboardItem({
            [CLIPBOARD_MIME]: new Blob([json], { type: CLIPBOARD_MIME }),
            "text/plain": new Blob([json], { type: "text/plain" }),
          }),
        ]);
      }
    } catch {
      // Progressive enhancement: the in-session fallback remains available.
    }
  }, [selection, session]);

  const paste = useCallback(async () => {
    if (!session) return;
    let payload = fallbackClipboard.current;
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.includes(CLIPBOARD_MIME)
            ? CLIPBOARD_MIME
            : item.types.includes("text/plain")
              ? "text/plain"
              : undefined;
          if (!type) continue;
          const text = await (await item.getType(type)).text();
          const parsed = JSON.parse(text) as EditorClipboardPayload;
          if (parsed.schema === "hawya.editor-clipboard.v1") payload = parsed;
          break;
        }
      }
    } catch {
      // Permission can be denied; use the in-session payload.
    }
    if (!payload) return;
    await run(async (active) => {
      const ids = await active.paste(payload as EditorClipboardPayload);
      if (ids.length) setSelectionState(ids, ids.at(-1));
    });
  }, [run, session, setSelectionState]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === " ") setSpaceDown(true);
      if (event.key === "Alt") setAltDown(true);
      if (isEditableTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        void run(async (active) => {
          if (event.shiftKey) await active.redo();
          else await active.undo();
        });
        return;
      }
      if (event.ctrlKey && key === "y") {
        event.preventDefault();
        void run((active) => active.redo());
        return;
      }
      if (mod && key === "d") {
        event.preventDefault();
        duplicate();
        return;
      }
      if (mod && key === "c") {
        event.preventDefault();
        void copy();
        return;
      }
      if (mod && key === "v") {
        event.preventDefault();
        void paste();
        return;
      }
      if (mod && key === "g") {
        event.preventDefault();
        if (event.shiftKey) ungroup();
        else group();
        return;
      }
      if (mod && key === "0") {
        event.preventDefault();
        fitPage();
        return;
      }
      if (mod && key === "1") {
        event.preventDefault();
        setViewport((current) => ({ ...current, zoom: 1 }));
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) &&
        unlockedSelected.length
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        const transforms = Object.fromEntries(
          unlockedSelected.map((layer) => [
            layer.id,
            { ...layer.transform, x: layer.transform.x + dx, y: layer.transform.y + dy },
          ]),
        );
        void run((active) => active.setTransforms("Nudge layers", transforms));
        return;
      }
      if (key === "v") setTool("select");
      if (key === "h") setTool("hand");
      if (key === "t") addText();
      if (key === "r") addShape();
      if (key === "i") addAsset();
      if (event.key === "+" || event.key === "=")
        setViewport((current) => ({ ...current, zoom: clampZoom(current.zoom * 1.15) }));
      if (event.key === "-")
        setViewport((current) => ({ ...current, zoom: clampZoom(current.zoom / 1.15) }));
      if (event.key === "Escape") {
        setTool("select");
        if (selection.length) setSelectionState([], undefined);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === " ") setSpaceDown(false);
      if (event.key === "Alt") setAltDown(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [
    addAsset,
    addShape,
    addText,
    copy,
    deleteSelected,
    duplicate,
    fitPage,
    group,
    paste,
    run,
    selection.length,
    setSelectionState,
    ungroup,
    unlockedSelected,
  ]);

  if (!session || !snapshot || !page || !scene) {
    return (
      <AppShell title={t("editor.title")} subtitle={t("editor.subtitle")}>
        <div className="page-content">
          <p>{error ?? t("common.loading")}</p>
        </div>
      </AppShell>
    );
  }

  const canGroup =
    unlockedSelected.filter(
      (layer) => layer.source === "extra" && !layer.parentGroupId && layer.type !== "group",
    ).length >= 2;
  const canUngroup = primaryLayer?.source === "extra" && primaryLayer.type === "group";

  return (
    <AppShell title={snapshot.project.metadata.name} subtitle={t("editor.subtitle")}>
      <div className="editor-page-shell">
        <header className="editor-topbar">
          <div className="editor-topbar__identity">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("editor.back")}
              onClick={() => navigate(projectPath(projectId))}
            >
              <ArrowLeft className="directional-icon" aria-hidden="true" size={16} />
            </Button>
            <div>
              <p className="panel-kicker">
                Editor · {page.canvas.width} × {page.canvas.height} {page.canvas.unit}
              </p>
              <h1>{page.name.en ?? page.name.ar ?? "Guide page"}</h1>
            </div>
          </div>
          <div className="editor-topbar__status">
            <span className="editor-save-state">
              <Save aria-hidden="true" size={14} /> {t("editor.autosave")}
            </span>
            <span>
              <SlidersHorizontal aria-hidden="true" size={14} />{" "}
              {snapshot.project.settings.snapEnabled ? t("editor.snapOn") : t("editor.snapOff")}
            </span>
          </div>
        </header>

        <EditorToolbar
          tool={tool}
          zoom={viewport.zoom}
          canUndo={Boolean(history?.canUndo)}
          canRedo={Boolean(history?.canRedo)}
          canGroup={canGroup}
          canUngroup={Boolean(canUngroup)}
          canDistribute={unlockedSelected.length >= 3}
          hasPlaceableAsset={Boolean(placeableAsset)}
          snapEnabled={snapshot.project.settings.snapEnabled}
          onTool={setTool}
          onToggleSnap={() =>
            void run((active) => active.setSnapEnabled(!snapshot.project.settings.snapEnabled))
          }
          onUndo={() => void run((active) => active.undo())}
          onRedo={() => void run((active) => active.redo())}
          onZoom={(zoom) => setViewport((current) => ({ ...current, zoom: clampZoom(zoom) }))}
          onFit={fitPage}
          onAddText={addText}
          onAddShape={addShape}
          onAddAsset={addAsset}
          onDuplicate={duplicate}
          onGroup={group}
          onUngroup={ungroup}
          onAlign={align}
          onDistribute={distribute}
          onShortcuts={() => setShortcutsOpen(true)}
        />

        <div className="editor-workspace">
          <EditorLayerTree
            layers={scene.layers}
            selectedIds={selection}
            onSelect={(id, toggle) => {
              if (!toggle) setSelectionState([id], id);
              else {
                const next = selection.includes(id)
                  ? selection.filter((item) => item !== id)
                  : [...selection, id];
                setSelectionState(next, next.at(-1));
              }
            }}
            onVisible={(id, visible) => void run((active) => active.setVisible(id, visible))}
            onLocked={(id, locked) => void run((active) => active.setLocked(id, locked))}
          />

          <main className="editor-canvas-column">
            {error ? (
              <p className="editor-error" role="alert">
                {error}
              </p>
            ) : null}
            <EditorCanvas
              scene={scene}
              unit={page.canvas.unit}
              viewport={viewport}
              tool={tool}
              selection={selection}
              primaryId={primaryId}
              transient={transient}
              assetUrls={assetUrls}
              spaceDown={spaceDown}
              snapEnabled={snapshot.project.settings.snapEnabled}
              snapDisabled={altDown}
              snapGuides={snapGuides}
              onViewport={setViewport}
              onSelection={setSelectionState}
              onBeginTransform={(transforms) => {
                session.beginTransform(transforms);
                setTransient(new Map(session.transient()));
              }}
              onPreviewTransforms={(transforms, guides) => {
                for (const [id, transform] of Object.entries(transforms))
                  session.previewTransform(id, transform);
                setTransient(new Map(session.transient()));
                setSnapGuides(guides);
              }}
              onCommitTransform={() => {
                setSnapGuides([]);
                void run((active) => active.commitTransform());
              }}
              onCommitText={(id, text) => void run((active) => active.updateText(id, text))}
            />
          </main>

          <EditorInspector
            layer={
              primaryLayer
                ? {
                    ...primaryLayer,
                    transform: transient.get(primaryLayer.id) ?? primaryLayer.transform,
                  }
                : undefined
            }
            onTransform={(transform) => {
              if (!primaryLayer || primaryLayer.locked) return;
              void run((active) =>
                active.setTransforms("Edit geometry", { [primaryLayer.id]: transform }),
              );
            }}
          />
        </div>
      </div>
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </AppShell>
  );
}
