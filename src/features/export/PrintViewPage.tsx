import { ArrowLeft, Printer } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  ExportWorkspaceQuery,
  type ExportWorkspace,
} from "@/application/queries/export-workspace-query";
import { inferGuideLocaleMode } from "@/application/queries/guide-studio-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { exportCenterPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { Button } from "@/components/ui/button";
import { resolveExportScene, type ExportTextStyle } from "@/domain/export/export-scene";
import type { ProjectId } from "@/domain/project/hawya-project";
import type { RenderedSceneLayer } from "@/editor/model/editor-types";
import { useI18n } from "@/i18n/I18nProvider";
import "@/features/export/export.css";

type PageUnit = "px" | "mm" | "in" | "pt";

function documentLength(value: number, unit: PageUnit): string {
  return `${value}${unit}`;
}

function layerStyle(layer: RenderedSceneLayer, unit: PageUnit): CSSProperties {
  const transform = layer.transform;
  return {
    position: "absolute",
    insetInlineStart: documentLength(transform.x, unit),
    top: documentLength(transform.y, unit),
    width: documentLength(transform.width, unit),
    height: documentLength(transform.height, unit),
    opacity: layer.opacity,
    transform: `rotate(${transform.rotation}deg) scale(${transform.scaleX}, ${transform.scaleY})`,
    transformOrigin: "center center",
    zIndex: layer.zIndex,
    overflow: "hidden",
  };
}

function PrintLayer({
  layer,
  layers,
  textStyles,
  fontFamilies,
  assetUrls,
  unit,
}: {
  layer: RenderedSceneLayer;
  layers: ReadonlyMap<string, RenderedSceneLayer>;
  textStyles: Readonly<Record<string, ExportTextStyle>>;
  fontFamilies: Readonly<Record<string, string>>;
  assetUrls: Readonly<Record<string, string>>;
  unit: PageUnit;
}): ReactNode {
  if (!layer.visible) return null;
  const common = {
    className: `hawya-print-layer hawya-print-layer--${layer.type}`,
    style: layerStyle(layer, unit),
    "data-layer-id": layer.id,
  };

  if (layer.type === "group") {
    return (
      <div {...common}>
        {layer.childIds.map((id) => {
          const child = layers.get(id);
          return child ? (
            <PrintLayer
              key={id}
              layer={child}
              layers={layers}
              textStyles={textStyles}
              fontFamilies={fontFamilies}
              assetUrls={assetUrls}
              unit={unit}
            />
          ) : null;
        })}
      </div>
    );
  }

  if (layer.type === "text") {
    const textStyle = textStyles[layer.id];
    const family = textStyle?.fontRefId ? fontFamilies[textStyle.fontRefId] : undefined;
    return (
      <div
        {...common}
        dir={layer.direction}
        lang={layer.language}
        style={{
          ...common.style,
          color: textStyle?.fill ?? layer.fill,
          fontFamily: family ? `"${family}"` : textStyle?.fontFamily,
          fontSize: textStyle ? documentLength(textStyle.fontSize, unit) : undefined,
          lineHeight: textStyle ? documentLength(textStyle.lineHeight, unit) : undefined,
          letterSpacing: textStyle ? documentLength(textStyle.letterSpacing, unit) : undefined,
          fontWeight: textStyle?.fontWeight,
          fontStyle: textStyle?.fontStyle,
          textAlign:
            layer.alignment === "start"
              ? "start"
              : layer.alignment === "end"
                ? "end"
                : layer.alignment,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
      >
        {layer.text}
      </div>
    );
  }

  if (layer.type === "image" || layer.type === "vector") {
    const source = layer.assetId ? assetUrls[layer.assetId] : undefined;
    return (
      <div {...common}>
        {source ? (
          <img
            src={source}
            alt=""
            className="hawya-print-asset"
            style={{
              objectFit: layer.type === "image" ? layer.fit : "contain",
              borderRadius:
                layer.type === "image" && layer.cornerRadius !== undefined
                  ? documentLength(layer.cornerRadius, unit)
                  : undefined,
            }}
          />
        ) : null}
      </div>
    );
  }

  const shapeStyle: CSSProperties = {
    ...common.style,
    background: layer.palette?.length
      ? `linear-gradient(90deg, ${layer.palette.join(", ")})`
      : layer.shape === "line"
        ? "transparent"
        : layer.fill,
    borderRadius:
      layer.shape === "ellipse"
        ? "50%"
        : layer.radius !== undefined
          ? documentLength(layer.radius, unit)
          : undefined,
    border:
      layer.shape === "line"
        ? undefined
        : layer.stroke
          ? `${documentLength(layer.strokeWidth ?? 1, unit)} solid ${layer.stroke}`
          : undefined,
  };

  if (layer.shape === "line") {
    shapeStyle.borderTop = `${documentLength(layer.strokeWidth ?? 1, unit)} solid ${layer.stroke ?? layer.fill}`;
    shapeStyle.height = 0;
    shapeStyle.top = `calc(${documentLength(layer.transform.y, unit)} + ${documentLength(layer.transform.height / 2, unit)})`;
  }

  return <div {...common} style={shapeStyle} />;
}

function printCss(workspace: ExportWorkspace): string {
  return workspace.snapshot.project.guide.pageOrder
    .map((pageId, index) => {
      const page = workspace.snapshot.project.guide.pages[pageId];
      if (!page) return "";
      return `@page hawya-page-${index + 1}{size:${page.canvas.width}${page.canvas.unit} ${page.canvas.height}${page.canvas.unit};margin:0}.hawya-print-sheet[data-print-index="${index}"]{page:hawya-page-${index + 1}}`;
    })
    .join("\n");
}

export default function PrintViewPage({ projectId }: { projectId: ProjectId }) {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<ExportWorkspace | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [fontFamilies, setFontFamilies] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const urls: string[] = [];

    const load = async () => {
      const query = new ExportWorkspaceQuery(runtime.projects, runtime.binaries);
      const next = await query.execute(projectId);
      if (!next) throw new Error(t("print.projectMissing"));
      if (next.snapshot.project.guide.pageOrder.length === 0) {
        throw new Error(t("print.noPages"));
      }

      const preflight = next.preflight("print");
      if (!preflight.ok) {
        throw new Error(
          preflight.issues
            .filter((issue) => issue.severity === "blocking")
            .map((issue) => issue.detail ?? issue.code)
            .join(" · "),
        );
      }

      const families: Record<string, string> = {};
      for (const font of next.snapshot.project.brand.typography.fonts) {
        const asset = next.snapshot.assets.find((candidate) => candidate.id === font.assetId);
        if (!asset) continue;
        const binary = await runtime.binaries.get(asset.contentHash);
        if (!binary) continue;
        families[font.id] = await runtime.fontRegistry.register(font, binary.bytes);
      }

      const entries: Array<[string, string]> = [];
      for (const asset of next.snapshot.assets) {
        if (!["image", "vector", "logo", "icon", "illustration"].includes(asset.kind)) {
          continue;
        }
        const binary = await runtime.binaries.get(asset.previewBinaryKey ?? asset.binaryKey);
        if (!binary) continue;
        const url = URL.createObjectURL(
          new Blob([Uint8Array.from(binary.bytes)], { type: binary.mime }),
        );
        urls.push(url);
        entries.push([asset.id, url]);
      }

      if (!active) return;
      setFontFamilies(families);
      setAssetUrls(Object.fromEntries(entries));
      setWorkspace(next);
    };

    void load().catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : t("common.unknownError"));
      }
    });

    return () => {
      active = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [projectId, runtime, t]);

  const localeMode = workspace ? inferGuideLocaleMode(workspace.snapshot) : "en";
  const scenes = useMemo(() => {
    if (!workspace) return [];
    return workspace.snapshot.project.guide.pageOrder.flatMap((pageId) => {
      const page = workspace.snapshot.project.guide.pages[pageId];
      return page ? [resolveExportScene(workspace.snapshot, page, localeMode)] : [];
    });
  }, [localeMode, workspace]);

  useEffect(() => {
    if (!workspace || scenes.length === 0) return;
    let active = true;

    const settle = async () => {
      setReady(false);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(".hawya-print-root img"),
      );
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
      await document.fonts.ready;
      if (active) setReady(true);
    };

    void settle();
    return () => {
      active = false;
    };
  }, [assetUrls, fontFamilies, scenes, workspace]);

  if (error) {
    return (
      <main className="hawya-print-error">
        <h1>{t("print.blocked")}</h1>
        <p>{error}</p>
        <Button onClick={() => navigate(exportCenterPath(projectId))}>{t("print.back")}</Button>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="hawya-print-error">
        <p>{t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="hawya-print-view" data-print-ready={ready ? "true" : "false"}>
      <style>{printCss(workspace)}</style>
      <header className="hawya-print-toolbar">
        <div>
          <p>{t("print.title")}</p>
          <strong>{ready ? t("print.ready") : t("print.preparing")}</strong>
        </div>
        <div>
          <Button variant="ghost" onClick={() => navigate(exportCenterPath(projectId))}>
            <ArrowLeft className="directional-icon" aria-hidden="true" size={16} />
            {t("print.back")}
          </Button>
          <Button disabled={!ready} onClick={() => window.print()}>
            <Printer aria-hidden="true" size={16} />
            {t("print.action")}
          </Button>
        </div>
      </header>
      <p className="hawya-print-note">{t("print.browserNote")}</p>

      <div className="hawya-print-root">
        {scenes.map((scene, index) => {
          const page = scene.page;
          const layerMap = new Map(
            scene.rendered.layers.map((layer) => [layer.id, layer] as const),
          );
          return (
            <section
              key={page.id}
              className="hawya-print-sheet"
              data-print-index={index}
              data-page-id={page.id}
              style={{
                width: documentLength(page.canvas.width, page.canvas.unit),
                height: documentLength(page.canvas.height, page.canvas.unit),
                background:
                  scene.rendered.background.type === "solid"
                    ? scene.rendered.background.color
                    : "transparent",
              }}
            >
              {scene.rendered.layers
                .filter((layer) => !layer.parentGroupId)
                .map((layer) => (
                  <PrintLayer
                    key={layer.id}
                    layer={layer}
                    layers={layerMap}
                    textStyles={scene.textStyles}
                    fontFamilies={fontFamilies}
                    assetUrls={assetUrls}
                    unit={page.canvas.unit}
                  />
                ))}
            </section>
          );
        })}
      </div>
    </main>
  );
}
