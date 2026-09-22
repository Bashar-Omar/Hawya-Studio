# Canonical Project Schema

This is the logical domain schema, not a direct Dexie table definition. Persistence may normalize it while import/export reassembles this shape.

```ts
type HawyaProject = {
  schemaVersion: number;
  id: UUID;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  brand: BrandSystem;
  guide: GuideDocument;
  mockups: MockupCollection;
  assetRefs: ProjectAssetRef[];
  templatePackRefs: TemplatePackRef[];
  revisions: RevisionSummary[];
};
```

## ProjectMetadata

```ts
type ProjectMetadata = {
  name: string;
  slug: string;
  clientName?: string;
  designerName?: string;
  description?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastOpenedAt?: ISODateTime;
  lastBackupAt?: ISODateTime;
  lastExportAt?: ISODateTime;
  thumbnailAssetId?: AssetId;
  tags: string[];
};
```

## ProjectSettings

```ts
type ProjectSettings = {
  defaultContentLocale: 'en' | 'ar';
  enabledContentLocales: Array<'en' | 'ar'>;
  defaultDirection: 'ltr' | 'rtl';
  guideProfile: 'minimal'|'standard'|'comprehensive'|'custom';
  pagePreset: PagePresetId;
  templateFamilyId: TemplateFamilyId;
  guideLocaleMode?: 'en'|'ar'|'bilingual';
  unitDisplay: 'px'|'mm'|'in'|'pt';
  snapEnabled: boolean;
  autosaveEnabled: boolean;
};
```

## Mockups — schema v2

Stage 09 adds reusable local application/mockup presets to the canonical project aggregate:

```ts
type MockupCollection = {
  presets: MockupPreset[];
};

type MockupPreset = {
  id: UUID;
  name: string;
  backgroundAssetId: AssetId;
  crop: NormalizedRect;
  surface?: MockupSurface;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

type MockupSurface = {
  corners: {
    topLeft: {x:number; y:number};
    topRight: {x:number; y:number};
    bottomRight: {x:number; y:number};
    bottomLeft: {x:number; y:number};
  };
  artwork:
    | {kind:'asset'; assetId:AssetId}
    | {kind:'page'; pageId:PageId};
  opacity: number;
  blendMode: 'normal'|'multiply'|'screen';
  shadowStrength: number;
  highlightStrength: number;
};
```

The crop and corner coordinates are normalized to `0..1`. Smart-surface corners are validated as a non-degenerate convex quad. Backgrounds reference raster image/mockup assets. Artwork can reference a canonical project asset or guide page. These references participate in normal asset deletion/reference safety and survive reload plus `.hawya` transfer.

Canvas/mockup coordinates are physical: `x = 0` always means the physical left edge. Switching the Hawya UI to RTL must not mirror stored crop or surface geometry.

## Invariants

- Current canonical project schema is **v2**.
- IDs are UUIDs generated with `crypto.randomUUID()` through an injected `IdGenerator` port.
- timestamps are ISO 8601 UTC strings from an injected Clock.
- `schemaVersion` changes only when archive/domain migrations are required.
- project ID is local identity; importing an archive creates a new ID by default to avoid accidental overwrite.
- asset references point to asset entities, never Blob URLs or browser-specific handles.
- no React/editor transient state appears in the project schema.

## Validation

Zod schemas are defined beside domain types and used at every external boundary: project archive import, template-pack import, migration output, and developer-data exports. Internal functions still preserve TypeScript types but may assume already validated domain objects only inside trusted boundaries.
## Stage 06 editor persistence boundary

Stage 06 does **not** persist viewport, selection, marquee state, transient pointer transforms, snap guides, or undo/redo stacks. Those remain editor-session state.

Template-owned scene items are projected from template slots and keep semantic PageContent unchanged. User layout changes to template items are stored in the existing `GuidePage.localOverrides` extensibility envelope as validated editor override records:

```ts
{
  targetId: `template:${slotId}`;
  transform?: { x; y; width; height; rotation; scaleX; scaleY };
  visible?: boolean;
  locked?: boolean;
  text?: string;
}
```

Extra editor layers continue to live in `GuidePage.extras` using the canonical layer schema. Moveable/CSS matrix strings are never persisted; only canonical document-unit geometry is stored. Canvas coordinates remain physical: `x = 0` is the physical left edge even when the application UI is RTL.

Simple group membership uses the existing optional `parentGroupId` plus a group layer's `data.childIds`. Editor history is reconstructed per session from canonical page state and is intentionally not part of Project Schema v1.

