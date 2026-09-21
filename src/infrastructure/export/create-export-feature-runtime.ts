import type { ExportWorkspace } from "@/application/queries/export-workspace-query";
import { ExportWorkspaceQuery } from "@/application/queries/export-workspace-query";
import type {
  ExportArtifact,
  ExportFormat,
  FontInclusionPolicy,
  RasterFormat,
} from "@/domain/export/export-contract";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import { WorkerFontOutliner } from "@/infrastructure/analysis/worker-font-outliner";
import { BrowserArtifactFiles } from "@/infrastructure/file-system/browser-artifact-files";
import { BrandArtifactRenderer } from "@/infrastructure/export/brand-artifact-renderer";
import { WorkerArchivePackager } from "@/infrastructure/export/worker-archive-packager";
import {
  DeliveryExportRenderer,
  type DeliverySelection,
  WebGuideExportRenderer,
} from "@/infrastructure/export/package-export-renderers";
import { ProjectArchiveExportRenderer } from "@/infrastructure/export/project-archive-export-renderer";
import { RasterExportRenderer } from "@/infrastructure/export/raster-export-renderer";
import { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";
import { WorkerSceneRasterizer } from "@/infrastructure/export/worker-scene-rasterizer";
import { slugifyFilename } from "@/infrastructure/export/export-helpers";
import type { PersistenceRuntime } from "@/infrastructure/runtime/create-persistence-runtime";

export type ExecutableExportFormat = Exclude<ExportFormat, "print">;

interface BaseRequest {
  format: ExecutableExportFormat;
  localeMode: TemplateLocaleMode;
}

export type ExportRequest =
  | (BaseRequest & { format: "hawya" })
  | (BaseRequest & {
      format: "svg-editable" | "svg-outlined";
      pageIds?: readonly string[];
    })
  | (BaseRequest & {
      format: RasterFormat;
      scale: number;
      quality?: number;
      background?: string;
      pageIds?: readonly string[];
    })
  | (BaseRequest & {
      format: "tokens-json" | "css-variables" | "brand-guidelines";
    })
  | (BaseRequest & {
      format: "web-guide";
      fontPolicy: FontInclusionPolicy;
    })
  | (BaseRequest & {
      format: "delivery";
      fontPolicy: FontInclusionPolicy;
      include: DeliverySelection;
    });

function requestFontPolicy(request: ExportRequest): FontInclusionPolicy | undefined {
  return request.format === "web-guide" || request.format === "delivery"
    ? request.fontPolicy
    : undefined;
}

function extensionFor(artifact: ExportArtifact): string {
  const candidate = artifact.filename.split(".").at(-1)?.toLowerCase();
  return candidate?.match(/^[a-z0-9]{1,8}$/)?.[0] ?? "bin";
}

export function createExportFeatureRuntime(
  runtime: Pick<PersistenceRuntime, "projects" | "binaries" | "archiveCodec">,
) {
  const workspace = new ExportWorkspaceQuery(runtime.projects, runtime.binaries);
  const outliner = new WorkerFontOutliner();
  const rasterizer = new WorkerSceneRasterizer();
  const packager = new WorkerArchivePackager();
  const editableSvg = new SvgExportRenderer(runtime.binaries, outliner, "editable");
  const outlinedSvg = new SvgExportRenderer(runtime.binaries, outliner, "outlined");
  const raster = {
    png: new RasterExportRenderer("png", outlinedSvg, rasterizer),
    webp: new RasterExportRenderer("webp", outlinedSvg, rasterizer),
    jpeg: new RasterExportRenderer("jpeg", outlinedSvg, rasterizer),
  } satisfies Record<RasterFormat, RasterExportRenderer>;
  const machine = {
    "tokens-json": new BrandArtifactRenderer("tokens-json"),
    "css-variables": new BrandArtifactRenderer("css-variables"),
    "brand-guidelines": new BrandArtifactRenderer("brand-guidelines"),
  } as const;
  const webGuide = new WebGuideExportRenderer(packager, outlinedSvg, runtime.binaries);
  const delivery = new DeliveryExportRenderer(packager, editableSvg, outlinedSvg, runtime.binaries);
  const archive = new ProjectArchiveExportRenderer(runtime.binaries, runtime.archiveCodec);
  const files = new BrowserArtifactFiles();

  const execute = async (
    active: ExportWorkspace,
    request: ExportRequest,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]> => {
    const preflight = active.preflight(request.format, requestFontPolicy(request));
    if (!preflight.ok) {
      const codes = preflight.issues
        .filter((issue) => issue.severity === "blocking")
        .map((issue) => issue.code)
        .join(", ");
      throw new Error(`Export is blocked by preflight: ${codes || "unknown blocker"}`);
    }

    let artifacts: ExportArtifact[];
    switch (request.format) {
      case "hawya":
        artifacts = await archive.render(active.snapshot, {}, signal);
        break;
      case "svg-editable":
        artifacts = await editableSvg.render(
          active.snapshot,
          {
            localeMode: request.localeMode,
            ...(request.pageIds ? { pageIds: request.pageIds } : {}),
          },
          signal,
        );
        break;
      case "svg-outlined":
        artifacts = await outlinedSvg.render(
          active.snapshot,
          {
            localeMode: request.localeMode,
            ...(request.pageIds ? { pageIds: request.pageIds } : {}),
          },
          signal,
        );
        break;
      case "png":
      case "webp":
      case "jpeg":
        artifacts = await raster[request.format].render(
          active.snapshot,
          {
            localeMode: request.localeMode,
            scale: request.scale,
            ...(request.quality !== undefined ? { quality: request.quality } : {}),
            ...(request.background ? { background: request.background } : {}),
            ...(request.pageIds ? { pageIds: request.pageIds } : {}),
          },
          signal,
        );
        break;
      case "tokens-json":
      case "css-variables":
      case "brand-guidelines":
        artifacts = await machine[request.format].render(
          active.snapshot,
          { localeMode: request.localeMode },
          signal,
        );
        break;
      case "web-guide":
        artifacts = await webGuide.render(
          active.snapshot,
          { localeMode: request.localeMode, fontPolicy: request.fontPolicy },
          signal,
        );
        break;
      case "delivery":
        artifacts = await delivery.render(
          active.snapshot,
          {
            localeMode: request.localeMode,
            fontPolicy: request.fontPolicy,
            include: request.include,
          },
          signal,
        );
        break;
    }

    if (artifacts.length <= 1) return artifacts;
    const entries = artifacts.map((artifact, index) => ({
      path: `files/item-${String(index + 1).padStart(3, "0")}.${extensionFor(artifact)}`,
      bytes: artifact.bytes,
    }));
    const bytes = await packager.pack(entries, signal);
    return [
      {
        filename: `${slugifyFilename(active.snapshot.project.metadata.slug)}-${request.format}.zip`,
        mime: "application/zip",
        bytes,
      },
    ];
  };

  return { workspace, execute, files };
}

export type ExportFeatureRuntime = ReturnType<typeof createExportFeatureRuntime>;
