export interface SanitizedSvgResult {
  svg: string;
  rejectedFeatures: string[];
  metadata: Record<string, unknown>;
}

export interface AssetSanitizer {
  sanitizeSvg(source: string): Promise<SanitizedSvgResult>;
}
