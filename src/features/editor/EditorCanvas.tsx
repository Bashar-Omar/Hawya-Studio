import ReactMoveable from "react-moveable";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { documentUnitScale, rectsIntersect, transformBounds } from "@/editor/geometry/geometry";
import { snapTransform } from "@/editor/geometry/snap-engine";
import type {
  EditorSnapGuide,
  EditorTool,
  EditorViewportState,
  LayerTransform,
  RenderedScene,
  RenderedSceneLayer,
  SceneLayerId,
} from "@/editor/model/editor-types";
import {
  moveableDragToDocument,
  moveableResizeToDocument,
  moveableRotateToDocument,
} from "@/infrastructure/editor/moveable-transform-adapter";
import { useI18n } from "@/i18n/I18nProvider";

interface EditorCanvasProps {
  scene: RenderedScene;
  unit: "px" | "mm" | "in" | "pt";
  viewport: EditorViewportState;
  tool: EditorTool;
  selection: SceneLayerId[];
  primaryId?: SceneLayerId;
  transient: ReadonlyMap<SceneLayerId, LayerTransform>;
  assetUrls: Readonly<Record<string, string>>;
  spaceDown: boolean;
  snapEnabled: boolean;
  snapDisabled: boolean;
  snapGuides: EditorSnapGuide[];
  onViewport: (viewport: EditorViewportState) => void;
  onSelection: (ids: SceneLayerId[], primaryId?: SceneLayerId) => void;
  onBeginTransform: (transforms: Readonly<Record<SceneLayerId, LayerTransform>>) => void;
  onPreviewTransforms: (
    transforms: Readonly<Record<SceneLayerId, LayerTransform>>,
    guides: EditorSnapGuide[],
  ) => void;
  onCommitTransform: () => void;
  onCommitText: (id: SceneLayerId, text: string) => void;
}

interface MarqueeState {
  startX: number;
  startY: number;
  x: number;
  y: number;
}

function backgroundCss(scene: RenderedScene): string {
  return scene.background.type === "solid" ? scene.background.color : "transparent";
}

function layerStyle(
  layer: RenderedSceneLayer,
  transform: LayerTransform,
  unitScale: number,
): CSSProperties {
  return {
    position: "absolute",
    left: transform.x * unitScale,
    top: transform.y * unitScale,
    width: Math.max(1, transform.width * unitScale),
    height: Math.max(1, transform.height * unitScale),
    opacity: layer.opacity,
    transform: `rotate(${transform.rotation}deg) scale(${transform.scaleX}, ${transform.scaleY})`,
    transformOrigin: "center center",
    zIndex: layer.zIndex,
  };
}

function InlineTextEditor({
  layer,
  value,
  onCommit,
}: {
  layer: Extract<RenderedSceneLayer, { type: "text" }>;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <textarea
      ref={inputRef}
      className="editor-inline-text"
      value={draft}
      dir={layer.direction}
      lang={layer.language}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCommit(draft);
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}

function eventHasAltKey(inputEvent: unknown): boolean {
  return (
    typeof inputEvent === "object" &&
    inputEvent !== null &&
    "altKey" in inputEvent &&
    (inputEvent as { altKey?: unknown }).altKey === true
  );
}

export function EditorCanvas(props: EditorCanvasProps) {
  const { t } = useI18n();
  const canvasSummaryId = useId();
  const viewportRef = useRef<HTMLElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const layerElements = useRef(new Map<SceneLayerId, HTMLElement>());
  const [moveableTarget, setMoveableTarget] = useState<HTMLElement | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [panning, setPanning] = useState<{
    pointerId: number;
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<SceneLayerId | null>(null);
  const initialTransforms = useRef<Record<SceneLayerId, LayerTransform>>({});
  const unitScale = documentUnitScale(props.unit);
  const selectedSet = useMemo(() => new Set(props.selection), [props.selection]);
  const layerMap = useMemo(
    () => new Map(props.scene.layers.map((layer) => [layer.id, layer] as const)),
    [props.scene.layers],
  );
  const primaryLayer = props.primaryId ? layerMap.get(props.primaryId) : undefined;

  useLayoutEffect(() => {
    setMoveableTarget(
      props.primaryId ? (layerElements.current.get(props.primaryId) ?? null) : null,
    );
  }, [props.primaryId]);

  const effectiveTransform = (layer: RenderedSceneLayer): LayerTransform =>
    props.transient.get(layer.id) ?? layer.transform;

  const pagePoint = (clientX: number, clientY: number) => {
    const page = pageRef.current;
    if (!page) return { x: 0, y: 0 };
    const rect = page.getBoundingClientRect();
    const divisor = Math.max(0.01, props.viewport.zoom * unitScale);
    return {
      x: Math.max(0, Math.min(props.scene.pageWidth, (clientX - rect.left) / divisor)),
      y: Math.max(0, Math.min(props.scene.pageHeight, (clientY - rect.top) / divisor)),
    };
  };

  const registerLayer = (id: SceneLayerId, element: HTMLElement | null) => {
    if (element) layerElements.current.set(id, element);
    else layerElements.current.delete(id);
  };

  const selectLayer = (layer: RenderedSceneLayer, toggle: boolean) => {
    if (layer.locked) return;
    if (!toggle) {
      props.onSelection([layer.id], layer.id);
      return;
    }
    const next = selectedSet.has(layer.id)
      ? props.selection.filter((id) => id !== layer.id)
      : [...props.selection, layer.id];
    props.onSelection(next, next.at(-1));
  };

  const renderLayer = (layer: RenderedSceneLayer): ReactNode => {
    if (!layer.visible) return null;
    const transform = effectiveTransform(layer);
    const classes = `editor-scene-layer editor-scene-layer--${layer.type} ${selectedSet.has(layer.id) ? "is-selected" : ""} ${layer.locked ? "is-locked" : ""}`;
    const common = {
      className: classes,
      style: layerStyle(layer, transform, unitScale),
      "data-layer-id": layer.id,
      ref: (element: HTMLDivElement | null) => registerLayer(layer.id, element),
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (props.tool !== "select" || props.spaceDown) return;
        event.stopPropagation();
        selectLayer(layer, event.shiftKey);
      },
      onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => {
        if (layer.type !== "text" || layer.locked) return;
        event.stopPropagation();
        setEditingId(layer.id);
        props.onSelection([layer.id], layer.id);
      },
    };

    if (layer.type === "group") {
      return (
        <div {...common} key={layer.id}>
          {layer.childIds.map((childId) => {
            const child = layerMap.get(childId);
            return child ? renderLayer(child) : null;
          })}
        </div>
      );
    }

    if (layer.type === "text") {
      return (
        <div {...common} key={layer.id} dir={layer.direction} lang={layer.language}>
          {editingId === layer.id ? (
            <InlineTextEditor
              layer={layer}
              value={layer.text}
              onCommit={(text) => {
                setEditingId(null);
                props.onCommitText(layer.id, text);
              }}
            />
          ) : (
            <div
              className="editor-text-content"
              style={{
                color: layer.fill,
                textAlign:
                  layer.alignment === "start"
                    ? "start"
                    : layer.alignment === "end"
                      ? "end"
                      : layer.alignment,
              }}
            >
              {layer.text}
            </div>
          )}
        </div>
      );
    }

    if (layer.type === "image" || layer.type === "vector") {
      const url = layer.assetId ? props.assetUrls[layer.assetId] : undefined;
      return (
        <div {...common} key={layer.id}>
          {url ? (
            <img
              src={url}
              alt=""
              draggable={false}
              className="editor-asset-content"
              style={{
                objectFit:
                  layer.type === "image" && !layer.crop
                    ? layer.fit
                    : layer.type === "image"
                      ? "fill"
                      : "contain",
                borderRadius: layer.type === "image" ? layer.cornerRadius : undefined,
                ...(layer.type === "image" && layer.crop
                  ? {
                      position: "absolute",
                      width: `${100 / layer.crop.width}%`,
                      height: `${100 / layer.crop.height}%`,
                      maxWidth: "none",
                      left: `${(-layer.crop.x / layer.crop.width) * 100}%`,
                      top: `${(-layer.crop.y / layer.crop.height) * 100}%`,
                    }
                  : {}),
              }}
            />
          ) : (
            <div className="editor-missing-asset">{t("editor.assetMissing")}</div>
          )}
        </div>
      );
    }

    return (
      <div
        {...common}
        key={layer.id}
        style={{
          ...common.style,
          background: layer.palette?.length ? undefined : layer.fill,
          borderRadius: layer.shape === "ellipse" ? "50%" : layer.radius,
          border: layer.stroke ? `${layer.strokeWidth ?? 1}px solid ${layer.stroke}` : undefined,
        }}
      >
        {layer.palette?.length ? (
          <div className="editor-palette-layer">
            {layer.palette.map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const beginMoveableTransform = (ids: SceneLayerId[]) => {
    const transforms = Object.fromEntries(
      ids.flatMap((id) => {
        const layer = layerMap.get(id);
        return layer && !layer.locked ? [[id, effectiveTransform(layer)] as const] : [];
      }),
    );
    initialTransforms.current = transforms;
    props.onBeginTransform(transforms);
  };

  const previewDrag = (dist: readonly [number, number] | number[], altKey: boolean) => {
    const primary = props.primaryId ? initialTransforms.current[props.primaryId] : undefined;
    if (!primary || !props.primaryId) return;
    const raw = moveableDragToDocument(primary, dist, {
      zoom: props.viewport.zoom,
      unit: props.unit,
    });
    const snapped = snapTransform({
      transform: raw,
      pageWidth: props.scene.pageWidth,
      pageHeight: props.scene.pageHeight,
      candidateLayers: props.scene.layers,
      movingIds: new Set(Object.keys(initialTransforms.current)),
      thresholdDocumentUnits: 5 / Math.max(0.01, props.viewport.zoom * unitScale),
      disabled: !props.snapEnabled || props.snapDisabled || altKey,
    });
    const deltaX = snapped.transform.x - primary.x;
    const deltaY = snapped.transform.y - primary.y;
    const next = Object.fromEntries(
      Object.entries(initialTransforms.current).map(([id, transform]) => [
        id,
        { ...transform, x: transform.x + deltaX, y: transform.y + deltaY },
      ]),
    );
    props.onPreviewTransforms(next, snapped.guides);
  };

  const onPagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (props.spaceDown || props.tool === "hand") return;
    if (event.target !== event.currentTarget || props.tool !== "select") return;
    const point = pagePoint(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    setMarquee({ startX: point.x, startY: point.y, x: point.x, y: point.y });
    props.onSelection([], undefined);
  };

  const onPagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marquee) return;
    const point = pagePoint(event.clientX, event.clientY);
    setMarquee((current) => (current ? { ...current, x: point.x, y: point.y } : current));
  };

  const onPagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marquee) return;
    const x = Math.min(marquee.startX, marquee.x);
    const y = Math.min(marquee.startY, marquee.y);
    const width = Math.abs(marquee.x - marquee.startX);
    const height = Math.abs(marquee.y - marquee.startY);
    const ids = props.scene.layers
      .filter((layer) => layer.visible && !layer.locked && !layer.parentGroupId)
      .filter((layer) =>
        rectsIntersect({ x, y, width, height }, transformBounds(effectiveTransform(layer))),
      )
      .map((layer) => layer.id);
    props.onSelection(ids, ids.at(-1));
    setMarquee(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onViewportPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!(props.tool === "hand" || props.spaceDown)) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning({
      pointerId: event.pointerId,
      clientX,
      clientY,
      panX: props.viewport.panX,
      panY: props.viewport.panY,
    });
    event.preventDefault();
  };

  const onViewportPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!panning || panning.pointerId !== event.pointerId) return;
    props.onViewport({
      ...props.viewport,
      panX: panning.panX + event.clientX - panning.clientX,
      panY: panning.panY + event.clientY - panning.clientY,
    });
  };

  const onViewportPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!panning || panning.pointerId !== event.pointerId) return;
    setPanning(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const marqueeRect = marquee
    ? {
        x: Math.min(marquee.startX, marquee.x),
        y: Math.min(marquee.startY, marquee.y),
        width: Math.abs(marquee.x - marquee.startX),
        height: Math.abs(marquee.y - marquee.startY),
      }
    : undefined;

  const transformable = primaryLayer && !primaryLayer.locked && editingId !== primaryLayer.id;
  const selectedUnlockedIds = props.selection.filter((id) => !layerMap.get(id)?.locked);

  return (
    <section
      className={`editor-viewport ${props.tool === "hand" || props.spaceDown ? "is-panning-tool" : ""}`}
      ref={viewportRef}
      aria-label={t("editor.canvasRegion")}
      aria-describedby={canvasSummaryId}
      onPointerDown={onViewportPointerDown}
      onPointerMove={onViewportPointerMove}
      onPointerUp={onViewportPointerUp}
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
        props.onViewport({
          ...props.viewport,
          zoom: Math.min(4, Math.max(0.1, props.viewport.zoom * factor)),
        });
      }}
    >
      <p className="sr-only" id={canvasSummaryId}>
        {t("editor.canvasSummary", {
          width: props.scene.pageWidth,
          height: props.scene.pageHeight,
          unit: props.unit,
          layers: props.scene.layers.length,
          visible: props.scene.layers.filter((layer) => layer.visible).length,
        })}
      </p>
      <div
        className="editor-page"
        ref={pageRef}
        style={{
          width: props.scene.pageWidth * unitScale,
          height: props.scene.pageHeight * unitScale,
          background: backgroundCss(props.scene),
          transform: `translate(${props.viewport.panX}px, ${props.viewport.panY}px) scale(${props.viewport.zoom})`,
        }}
        onPointerDown={onPagePointerDown}
        onPointerMove={onPagePointerMove}
        onPointerUp={onPagePointerUp}
      >
        {props.scene.layers.filter((layer) => !layer.parentGroupId).map(renderLayer)}
        {marqueeRect ? (
          <div
            className="editor-marquee"
            style={{
              left: marqueeRect.x * unitScale,
              top: marqueeRect.y * unitScale,
              width: marqueeRect.width * unitScale,
              height: marqueeRect.height * unitScale,
            }}
          />
        ) : null}
        {props.snapGuides.map((guide) => (
          <div
            className={`editor-snap-guide editor-snap-guide--${guide.axis}`}
            key={`${guide.axis}-${guide.value}-${guide.source}`}
            style={
              guide.axis === "x"
                ? { left: guide.value * unitScale }
                : { top: guide.value * unitScale }
            }
          />
        ))}
      </div>

      {transformable && moveableTarget ? (
        <ReactMoveable
          target={moveableTarget}
          container={pageRef.current}
          draggable
          resizable={selectedUnlockedIds.length === 1 && primaryLayer.type !== "group"}
          rotatable={selectedUnlockedIds.length === 1 && primaryLayer.type !== "group"}
          origin={false}
          keepRatio={false}
          throttleDrag={0}
          throttleResize={0}
          throttleRotate={0}
          onDragStart={() => beginMoveableTransform(selectedUnlockedIds)}
          onDrag={(event) => previewDrag(event.dist, eventHasAltKey(event.inputEvent))}
          onDragEnd={() => props.onCommitTransform()}
          onResizeStart={() => beginMoveableTransform(primaryLayer ? [primaryLayer.id] : [])}
          onResize={(event) => {
            const initial = primaryLayer ? initialTransforms.current[primaryLayer.id] : undefined;
            if (!initial || !primaryLayer) return;
            const next = moveableResizeToDocument(
              initial,
              { widthPx: event.width, heightPx: event.height, dragDist: event.drag?.dist },
              { zoom: props.viewport.zoom, unit: props.unit },
            );
            props.onPreviewTransforms({ [primaryLayer.id]: next }, []);
          }}
          onResizeEnd={() => props.onCommitTransform()}
          onRotateStart={() => beginMoveableTransform(primaryLayer ? [primaryLayer.id] : [])}
          onRotate={(event) => {
            const initial = primaryLayer ? initialTransforms.current[primaryLayer.id] : undefined;
            if (!initial || !primaryLayer) return;
            props.onPreviewTransforms(
              {
                [primaryLayer.id]: moveableRotateToDocument(initial, initial.rotation + event.dist),
              },
              [],
            );
          }}
          onRotateEnd={() => props.onCommitTransform()}
        />
      ) : null}
    </section>
  );
}
