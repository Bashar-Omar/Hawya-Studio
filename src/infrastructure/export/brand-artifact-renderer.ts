import type { ExportArtifact, ExportRenderer } from "@/domain/export/export-contract";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";
import {
  buildBrandGuidelinesMarkdown,
  buildCssVariables,
  buildDesignTokensJson,
} from "@/infrastructure/export/brand-artifact-builders";

export type BrandArtifactKind = "tokens-json" | "css-variables" | "brand-guidelines";

export interface BrandArtifactOptions {
  localeMode: TemplateLocaleMode;
}

export class BrandArtifactRenderer implements ExportRenderer<BrandArtifactOptions> {
  readonly format: BrandArtifactKind;

  constructor(private readonly kind: BrandArtifactKind) {
    this.format = kind;
  }

  async render(
    snapshot: ProjectSnapshot,
    options: BrandArtifactOptions,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]> {
    if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
    if (this.kind === "tokens-json") {
      return [
        {
          filename: "tokens.json",
          mime: "application/json",
          bytes: buildDesignTokensJson(snapshot),
        },
      ];
    }
    if (this.kind === "css-variables") {
      return [
        {
          filename: "variables.css",
          mime: "text/css",
          bytes: buildCssVariables(snapshot),
        },
      ];
    }
    return [
      {
        filename: "brand-guidelines.md",
        mime: "text/markdown",
        bytes: buildBrandGuidelinesMarkdown(snapshot, options.localeMode),
      },
    ];
  }
}
