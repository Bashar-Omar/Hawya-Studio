export interface FontAxisAnalysis {
  tag: string;
  min: number;
  default: number;
  max: number;
}

export interface ArabicCoverageAnalysis {
  supported: number;
  total: number;
  ratio: number;
  missingCodePoints: number[];
  hasGsub: boolean;
  hasGpos: boolean;
}

export interface FontAnalysisResult {
  familyName: string;
  subfamilyName?: string;
  postscriptName?: string;
  weight?: number;
  style?: "normal" | "italic" | "oblique";
  variableAxes?: FontAxisAnalysis[];
  coverage: {
    arabic: ArabicCoverageAnalysis;
    characterCount: number;
  };
}

export interface FontAnalyzer {
  analyze(bytes: Uint8Array): Promise<FontAnalysisResult>;
}
