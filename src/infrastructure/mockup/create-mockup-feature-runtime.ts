import { inferGuideLocaleMode } from "@/application/queries/guide-studio-query";
import type { MockupRenderProgress, MockupRenderResult } from "@/application/ports/mockup-renderer";
import type { MockupPreset } from "@/domain/mockup/mockup";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import { WorkerFontOutliner } from "@/infrastructure/analysis/worker-font-outliner";
import { BrowserArtifactFiles } from "@/infrastructure/file-system/browser-artifact-files";
import { RasterExportRenderer } from "@/infrastructure/export/raster-export-renderer";
import { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";
import { WorkerSceneRasterizer } from "@/infrastructure/export/worker-scene-rasterizer";
import {
  supportsMockupWorker,
  WorkerMockupRenderer,
} from "@/infrastructure/mockup/worker-mockup-renderer";
import type { PersistenceRuntime } from "@/infrastructure/runtime/create-persistence-runtime";

function slug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "mockup"
  );
}

export function createMockupFeatureRuntime(runtime: Pick<PersistenceRuntime, "binaries">) {
  const renderer = new WorkerMockupRenderer();
  const outliner = new WorkerFontOutliner();
  const rasterizer = new WorkerSceneRasterizer();
  const outlinedSvg = new SvgExportRenderer(runtime.binaries, outliner, "outlined");
  const pageRaster = new RasterExportRenderer("png", outlinedSvg, rasterizer);
  const files = new BrowserArtifactFiles();

  const assetSource = async (snapshot: ProjectSnapshot, assetId: string) => {
    const asset = snapshot.assets.find((candidate) => candidate.id === assetId);
    if (!asset) throw new Error("Mockup source asset is missing");
    if (asset.mime === "image/svg+xml" && asset.security.sanitized !== true) {
      throw new Error("SVG mockup artwork must be sanitized before rendering");
    }
    const binary = await runtime.binaries.get(asset.binaryKey);
    if (!binary) throw new Error(`Local binary for ${asset.name} is unavailable`);
    return {
      key: asset.contentHash,
      mime: binary.mime || asset.mime,
      bytes: binary.bytes,
    };
  };

  const artworkSource = async (
    snapshot: ProjectSnapshot,
    preset: MockupPreset,
    signal: AbortSignal,
  ) => {
    const artwork = preset.surface?.artwork;
    if (!artwork) return undefined;
    if (artwork.kind === "asset") return assetSource(snapshot, artwork.assetId);

    const artifacts = await pageRaster.render(
      snapshot,
      {
        localeMode: inferGuideLocaleMode(snapshot),
        scale: 1,
        pageIds: [artwork.pageId],
      },
      signal,
    );
    const artifact = artifacts[0];
    if (!artifact) throw new Error("Guide page artwork could not be rendered");
    return {
      key: `page:${artwork.pageId}:${snapshot.project.metadata.updatedAt}`,
      mime: artifact.mime,
      bytes: artifact.bytes,
    };
  };

  const render = async (
    snapshot: ProjectSnapshot,
    preset: MockupPreset,
    signal: AbortSignal,
    options: {
      maxDimension?: number;
      onProgress?: (progress: MockupRenderProgress) => void;
    } = {},
  ): Promise<MockupRenderResult> => {
    const background = await assetSource(snapshot, preset.backgroundAssetId);
    const artwork = await artworkSource(snapshot, preset, signal);
    return renderer.render(
      {
        background,
        crop: preset.crop,
        ...(preset.surface ? { surface: preset.surface } : {}),
        ...(artwork ? { artwork } : {}),
        ...(options.maxDimension ? { maxDimension: options.maxDimension } : {}),
      },
      signal,
      options.onProgress,
    );
  };

  const download = (
    snapshot: ProjectSnapshot,
    preset: MockupPreset,
    result: MockupRenderResult,
  ) => {
    files.download({
      filename: `${slug(snapshot.project.metadata.slug)}-${slug(preset.name)}-mockup.png`,
      mime: result.mime,
      bytes: result.bytes,
    });
  };

  const dispose = () => {
    renderer.dispose();
    outliner.dispose();
  };

  return {
    render,
    download,
    dispose,
    smartSupported: supportsMockupWorker(),
  };
}

export type MockupFeatureRuntime = ReturnType<typeof createMockupFeatureRuntime>;
