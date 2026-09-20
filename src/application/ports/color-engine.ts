export interface ColorChannels {
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  oklch: { l: number; c: number; h: number };
  suggestedCmyk: { c: number; m: number; y: number; k: number };
}

export interface ColorEngine {
  derive(hex: string): Promise<ColorChannels>;
  contrast(foregroundHex: string, backgroundHex: string): Promise<number>;
}
