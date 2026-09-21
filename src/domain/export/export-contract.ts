import type { ProjectSnapshot } from "@/domain/project/hawya-project";

export type ExportFormat =
  | "hawya"
  | "svg-editable"
  | "svg-outlined"
  | "png"
  | "webp"
  | "jpeg"
  | "print"
  | "tokens-json"
  | "css-variables"
  | "brand-guidelines"
  | "web-guide"
  | "delivery";

export type FontInclusionPolicy = "omit" | "include-confirmed";
export type RasterFormat = "png" | "webp" | "jpeg";

export interface ExportFidelityContract {
  format: ExportFormat;
  editable: boolean;
  vector: boolean;
  requiresFonts: boolean;
  description: string;
  limitation?: string;
}

export const EXPORT_FIDELITY_CONTRACTS: Record<ExportFormat, ExportFidelityContract> = {
  hawya: {
    format: "hawya",
    editable: true,
    vector: false,
    requiresFonts: false,
    description: "Complete Hawya project backup and transfer archive.",
  },
  "svg-editable": {
    format: "svg-editable",
    editable: true,
    vector: true,
    requiresFonts: true,
    description: "Editable vector artwork with live text.",
    limitation: "Matching text appearance requires the referenced fonts on the receiving system.",
  },
  "svg-outlined": {
    format: "svg-outlined",
    editable: false,
    vector: true,
    requiresFonts: true,
    description: "Vector artwork with text converted to glyph paths.",
    limitation: "Text is no longer editable, searchable, or accessible as text.",
  },
  png: {
    format: "png",
    editable: false,
    vector: false,
    requiresFonts: true,
    description: "Screen-RGB lossless raster artwork.",
  },
  webp: {
    format: "webp",
    editable: false,
    vector: false,
    requiresFonts: true,
    description: "Screen-RGB WebP raster artwork.",
  },
  jpeg: {
    format: "jpeg",
    editable: false,
    vector: false,
    requiresFonts: true,
    description: "Screen-RGB JPEG raster artwork.",
  },
  print: {
    format: "print",
    editable: false,
    vector: true,
    requiresFonts: true,
    description: "Browser print workflow rendered from the canonical page scene.",
    limitation: "RGB browser PDF workflow; not PDF/X or press-ready CMYK.",
  },
  "tokens-json": {
    format: "tokens-json",
    editable: true,
    vector: false,
    requiresFonts: false,
    description: "Stable machine-readable brand token data.",
  },
  "css-variables": {
    format: "css-variables",
    editable: true,
    vector: false,
    requiresFonts: false,
    description: "Digital sRGB color and typography variables for the web.",
  },
  "brand-guidelines": {
    format: "brand-guidelines",
    editable: true,
    vector: false,
    requiresFonts: false,
    description: "Human- and AI-readable Markdown brand guidelines.",
  },
  "web-guide": {
    format: "web-guide",
    editable: true,
    vector: false,
    requiresFonts: false,
    description: "Self-contained static brand guide bundle with no Hawya backend dependency.",
  },
  delivery: {
    format: "delivery",
    editable: true,
    vector: false,
    requiresFonts: false,
    description: "Combined client/developer delivery package.",
  },
};

export type ExportPreflightSeverity = "warning" | "blocking";

export interface ExportPreflightIssue {
  code: string;
  severity: ExportPreflightSeverity;
  location: string;
  detail?: string;
}

export interface ExportPreflightResult {
  ok: boolean;
  issues: ExportPreflightIssue[];
  counts: Record<ExportPreflightSeverity, number>;
}

export interface ExportArtifact {
  filename: string;
  mime: string;
  bytes: Uint8Array;
}

export interface ExportRenderer<TOptions> {
  readonly format: ExportFormat;
  render(
    snapshot: ProjectSnapshot,
    options: TOptions,
    signal: AbortSignal,
  ): Promise<ExportArtifact[]>;
}
