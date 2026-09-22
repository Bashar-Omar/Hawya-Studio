export interface FontOutlineGlyph {
  pathData: string;
  x: number;
  y: number;
}

export interface FontOutlineOptions {
  fontSize: number;
  letterSpacing: number;
  features?: Readonly<Record<string, boolean>>;
}

export interface FontOutlineResult {
  glyphs: FontOutlineGlyph[];
  unitsPerEm: number;
  ascent: number;
  descent: number;
  advanceWidth: number;
}

export interface FontOutliner {
  outline(
    bytes: Uint8Array,
    text: string,
    options: FontOutlineOptions,
    signal: AbortSignal,
  ): Promise<FontOutlineResult>;
}
