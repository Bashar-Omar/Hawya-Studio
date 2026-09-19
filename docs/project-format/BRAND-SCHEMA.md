# Brand System Schema

```ts
type BrandSystem = {
  identity: BrandIdentity;
  logos: LogoSystem;
  colors: ColorSystem;
  typography: TypographySystem;
  visualLanguage: VisualLanguageSystem;
  digital?: DigitalTokenSystem;
  notes?: LocalizedString;
};
```

## Identity

```ts
type BrandIdentity = {
  brandName: LocalizedString;
  descriptor?: LocalizedString;
  story?: LocalizedRichText;
  mission?: LocalizedString;
  vision?: LocalizedString;
  values: Array<{id: UUID; name: LocalizedString; description?: LocalizedString}>;
  personality: Array<{id: UUID; label: LocalizedString; description?: LocalizedString}>;
  voice?: {
    summary?: LocalizedString;
    traits: Array<{id: UUID; do: LocalizedString; dont?: LocalizedString}>;
  };
  audiences?: Array<{id: UUID; name: LocalizedString; description?: LocalizedString}>;
};
```

No identity field except brand name is mandatory. Missing fields are represented as missing, not generated filler.

## Logo system

```ts
type LogoVariant = {
  id: UUID;
  name: LocalizedString;
  role: 'primary'|'secondary'|'logomark'|'wordmark'|'monochrome'|'reversed'|'custom';
  assetId: AssetId;
  preferredBackground?: ColorTokenId;
  usage?: LocalizedString;
  geometry?: LogoGeometry;
};

type LogoSystem = {
  variants: LogoVariant[];
  primaryLogoId?: UUID;
  rules: {
    clearSpace?: ClearSpaceRule;
    minimumSize?: MinimumSizeRule;
    allowedBackgrounds?: BackgroundRule[];
    incorrectUsage: IncorrectUsageRule[];
  };
};
```

Smart-analysis fields include `source: 'measured'|'suggested'|'user'` where professional interpretation is involved.

## Colors

```ts
type ColorToken = {
 id: UUID;
 name: LocalizedString;
 role: 'primary'|'secondary'|'accent'|'neutral'|'supporting'|'semantic'|'custom';
 srgbHex: `#${string}`;
 alpha: number;
 oklch?: {l:number;c:number;h:number};
 rgb: {r:number;g:number;b:number};
 hsl?: {h:number;s:number;l:number};
 print?: {
   suggestedCmyk?: {c:number;m:number;y:number;k:number};
   verifiedCmyk?: {c:number;m:number;y:number;k:number};
   pantoneName?: string;
   note?: LocalizedString;
 };
 usage?: LocalizedString;
};
```

Never overwrite manually verified print values when the screen HEX changes. Flag them as needing review instead.

## Typography

```ts
type FontAssetRef = {
 id: UUID;
 assetId: AssetId;
 familyName: string;
 subfamilyName?: string;
 postscriptName?: string;
 weight?: number;
 style?: 'normal'|'italic'|'oblique';
 variableAxes?: FontAxis[];
 coverage?: ScriptCoverage;
 licenseNote?: string;
};

type TextStyleToken = {
 id: UUID;
 name: string;
 role: 'display'|'h1'|'h2'|'h3'|'body'|'body-small'|'caption'|'button'|'custom';
 fontRefId: UUID;
 fontSize: number;
 lineHeight: number;
 letterSpacing: number;
 fontWeight?: number;
 direction: 'auto'|'ltr'|'rtl';
 language?: string;
 colorTokenId?: UUID;
 features?: Record<string, boolean>;
};
```

## Localized strings

Plain textual brand content uses localized objects. Page-specific text that is intentionally not semantic brand content may be stored directly in text layers with language/direction metadata.
