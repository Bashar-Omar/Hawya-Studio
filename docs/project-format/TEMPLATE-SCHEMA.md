# Template System Schema

Templates are code/data-owned layouts. They never own the user's semantic content.

```ts
type PageTemplate = {
 id: TemplateId;
 version: number;
 familyId: TemplateFamilyId;
 supportedPageTypes: PageType[];
 supportedLocaleModes: ('en'|'ar'|'bilingual')[];
 canvasCompatibility: CanvasCompatibility;
 slots: TemplateSlot[];
 layers: TemplateLayerDefinition[];
 guides?: GuideLine[];
 thumbnail: TemplatePreviewDescriptor;
};
```

## TemplateSlot

```ts
type TemplateSlot = {
 id: SlotId;
 role: string; // e.g. 'page.title', 'brand.logo.primary', 'colors.palette'
 contentKinds: ContentKind[];
 required: boolean;
 maxItems?: number;
 fallback?: FallbackPolicy;
};
```

## Binding

A `ContentBinding` is declarative, for example:

```text
brand.logo.primary
brand.colors.primary[]
brand.typography.styles[h1]
page.content.introduction
page.content.custom[...]
```

Do not execute arbitrary JavaScript from template files. Template packs are trusted application data in v1. A future third-party template format requires a safe declarative schema.

## Template switching

Switching templates:
1. validate target supports current `semanticType` and locale mode;
2. map semantic bindings to target slots;
3. preserve `PageContent`;
4. preserve extras unless user requests reset;
5. surface any unmapped content before confirmation;
6. create one undoable command.

## Built-in families

Ship at least three visually distinct but restrained families:
- **Essential** — minimal, whitespace-first;
- **Editorial** — typography-led, asymmetric layouts;
- **Grid** — Swiss/grid-forward, modular.

Do not call them “luxury”/“modern” as if those were universal design categories. More packs can be added later.
