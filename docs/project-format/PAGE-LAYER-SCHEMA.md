# Guide, Page and Layer Schema

## Guide

```ts
type GuideDocument = {
  sections: GuideSection[];
  pageOrder: PageId[];
  pages: Record<PageId, GuidePage>;
};

type GuideSection = {
  id: UUID;
  type: SectionType;
  title: LocalizedString;
  pageIds: PageId[];
  collapsedInEditor?: boolean; // UI convenience may instead be session-only
};
```

## Page

```ts
type GuidePage = {
  id: PageId;
  name: LocalizedString;
  semanticType: PageType;
  content: PageContent;
  templateBinding: {
    templateId: TemplateId;
    version: number;
    slotBindings: Record<SlotId, ContentBinding>;
  };
  canvas: {
    width: number;
    height: number;
    unit: 'px'|'mm'|'in'|'pt';
    background: Paint;
    bleed?: {top:number;right:number;bottom:number;left:number}; // metadata only unless renderer supports it
  };
  extras: Layer[];
  localOverrides: LocalOverride[];
};
```

The canvas coordinate system uses the page's document units. Screen scaling is renderer state and never saved into layer geometry.

## Layers

All layers share:

```ts
type LayerBase = {
 id: LayerId;
 name: string;
 type: LayerType;
 visible: boolean;
 locked: boolean;
 opacity: number;
 blendMode?: SupportedBlendMode;
 transform: {
   x:number; y:number; width:number; height:number;
   rotation:number; scaleX:number; scaleY:number;
 };
 parentGroupId?: LayerId;
 source: 'template'|'extra';
};
```

### TextLayer
Stores semantic text or a reference:

```ts
type TextLayer = LayerBase & {
 type:'text';
 content: TextContent | {binding: ContentBinding};
 typography: TextStyle | {tokenId: TextStyleTokenId; overrides?: Partial<TextStyle>};
 fill: Paint | {colorTokenId: ColorTokenId};
 alignment:'start'|'center'|'end'|'justify';
 verticalAlign:'top'|'middle'|'bottom';
 direction:'auto'|'ltr'|'rtl';
 language?:string;
 overflow:'clip'|'ellipsis'|'visible';
};
```

### ImageLayer
References an asset, not a data URL.

```ts
type ImageLayer = LayerBase & {
 type:'image';
 assetId:AssetId;
 fit:'cover'|'contain'|'fill';
 crop?:NormalizedRect;
 cornerRadius?:number;
};
```

### VectorLayer
References sanitized SVG asset or inline safe generated vector primitive. Preserve original asset as separate binary.

### ShapeLayer
Rectangle/ellipse/line/polygon with Paint stroke/fill and radius. Keep the initial shape grammar intentionally small.

### GroupLayer
Owns child IDs and transforms as a group. Normalize coordinate transforms when group/ungroup to preserve appearance.

## Z order

Z order is explicit in per-page flattened layer order or child order. Do not rely on object insertion order.

## Local override semantics

A local override records which template/token-bound property was detached. Audits can report these overrides. “Reset to token/template” restores the reference.
