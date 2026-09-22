# Hawya Project Format v2 — Implementation Notes

This document records the Stage 09 project-format change for reusable Mockups & Applications. It extends, but does not replace, the canonical project-format documents.

## Why schema v2 exists

Reusable mockup presets are user-authored project state. They must survive browser reload, archive export/import and project duplication, so they belong in the canonical `HawyaProject` aggregate rather than transient React state or opaque asset metadata.

Schema v2 adds:

```text
project.mockups.presets[]
  -> stable preset id/name/timestamps
  -> raster background AssetId
  -> normalized crop
  -> optional smart planar surface
     -> four normalized physical corners
     -> artwork source: AssetId or PageId
     -> opacity / normal|multiply|screen
     -> limited shadow/highlight strengths
```

## Migration v1 → v2

The migration runner adds an empty mockup collection and updates the schema version. It does not infer presets from existing image assets.

Migration remains:

- one-way and sequential;
- non-mutating with respect to the supplied source object;
- validated immediately through the target Zod schema;
- shared by local repository reload and `.hawya` archive import.

## IndexedDB

No Dexie index/table version bump is needed because the collection is stored as an unindexed field on the existing project row. Background/artwork bytes remain ordinary content-addressed binaries referenced through existing Asset entities.

## Reference integrity

Mockup background and artwork AssetIds participate in the existing recursive project-reference count. An asset used by a preset cannot be deleted as though it were unused.

Page artwork references remain PageIds and are resolved against the canonical guide at render time.

## Geometry contract

Crop and corners are normalized `0..1` values. Smart surfaces must be convex, non-self-crossing and non-degenerate.

Coordinates are physical document coordinates: `x=0` is physical left and `y=0` is physical top regardless of English/Arabic UI direction.

## Non-goals

Schema v2 does not store:

- decoded ImageBitmaps;
- Blob/object URLs;
- WebGL resources;
- preview PNG results;
- PSD smart objects;
- displacement maps;
- generative backgrounds;
- editor selection or pointer state.
