import type { SceneRasterizer } from "@/application/ports/scene-rasterizer";
import type { ExportArtifact, ExportRenderer, RasterFormat } from "@/domain/export/export-contract";
import { rasterPixelDimensions } from "@/domain/export/raster-dimensions";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import { slugifyFilename } from "@/infrastructure/export/export-helpers";
import type { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";

export interface RasterExportOptions {
  localeMode: TemplateLocaleMode;
  scale: number;
  quality?: number;
  background?: string;
  pageIds?: readonly string[];
}

const MIME = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" } as const;

export class RasterExportRenderer implements ExportRenderer<RasterExportOptions> {
  readonly format: RasterFormat;

  constructor(
    format: RasterFormat,
    private readonly svg: SvgExportRenderer,
    private readonly rasterizer: SceneRasterizer,
  ) {
    this.format = format;
  }

  async render(
    snapshot: ProjectSnapshot,
    options: RasterExportOptions,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]> {
    const pageIds = options.pageIds ?? snapshot.project.guide.pageOrder;
    const svgs = await this.svg.render(
      snapshot,
      { localeMode: options.localeMode, pageIds },
      signal,
    );
    const artifacts: ExportArtifact[] = [];
    for (let index = 0; index < svgs.length; index += 1) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const pageId = pageIds[index];
      const page = pageId ? snapshot.project.guide.pages[pageId] : undefined;
      if (!page) throw new Error("Raster export page is missing");
      const svgText = new TextDecoder().decode(svgs[index]?.bytes);
      const dimensions = rasterPixelDimensions(
        page.canvas.width,
        page.canvas.height,
        page.canvas.unit,
        options.scale,
      );
      const bytes = await this.rasterizer.rasterize(
        {
          svg: svgText,
          width: dimensions.width,
          height: dimensions.height,
          format: this.format,
          ...(options.quality !== undefined ? { quality: options.quality } : {}),
          ...(options.background ? { background: options.background } : {}),
        },
        signal,
      );
      const source =
        svgs[index]?.filename.replace(/-outlined\.svg$/, "").replace(/\.svg$/, "") ??
        `${slugifyFilename(snapshot.project.metadata.name)}-${index + 1}`;
      artifacts.push({
        filename: `${source}.${this.format === "jpeg" ? "jpg" : this.format}`,
        mime: MIME[this.format],
        bytes,
      });
    }
    return artifacts;
  }
}
