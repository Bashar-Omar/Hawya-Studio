import type { SceneRasterizer } from "@/application/ports/scene-rasterizer";
import type { ExportArtifact, ExportRenderer, RasterFormat } from "@/domain/export/export-contract";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import { slugifyFilename } from "@/infrastructure/export/export-helpers";
import type { SvgExportRenderer } from "@/infrastructure/export/svg-export-renderer";

export interface RasterExportOptions {
  format: RasterFormat;
  localeMode: TemplateLocaleMode;
  scale: number;
  quality?: number;
  pageIds?: readonly string[];
}

const MIME = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" } as const;

export class RasterExportRenderer implements ExportRenderer<RasterExportOptions> {
  readonly format = "png" as const;
  constructor(private readonly svg: SvgExportRenderer, private readonly rasterizer: SceneRasterizer) {}

  async render(snapshot: ProjectSnapshot, options: RasterExportOptions, signal: AbortSignal): Promise<ExportArtifact[]> {
    const pageIds = options.pageIds ?? snapshot.project.guide.pageOrder;
    const svgs = await this.svg.render(snapshot, { mode: "outlined", localeMode: options.localeMode, pageIds }, signal);
    const artifacts: ExportArtifact[] = [];
    for (let index = 0; index < svgs.length; index += 1) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const pageId = pageIds[index];
      const page = pageId ? snapshot.project.guide.pages[pageId] : undefined;
      if (!page) throw new Error("Raster export page is missing");
      const svgText = new TextDecoder().decode(svgs[index]?.bytes);
      const bytes = await this.rasterizer.rasterize({ svg: svgText, width: page.canvas.width, height: page.canvas.height, scale: options.scale, format: options.format, ...(options.quality !== undefined ? { quality: options.quality } : {}) }, signal);
      const source = svgs[index]?.filename.replace(/-outlined\.svg$/, "").replace(/\.svg$/, "") ?? `${slugifyFilename(snapshot.project.metadata.name)}-${index + 1}`;
      artifacts.push({ filename: `${source}.${options.format === "jpeg" ? "jpg" : options.format}`, mime: MIME[options.format], bytes });
    }
    return artifacts;
  }
}
