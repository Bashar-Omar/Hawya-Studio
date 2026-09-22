# Stage 09 Research Notes — Mockups & Applications

Date: 2026-09-22  
Stage: 09 — Mockups & Applications

## Binding scope

Stage 09 is implemented against the current Project Pack with these non-negotiable boundaries:

- uploaded finished mockup/application imagery remains ordinary local project assets;
- reusable mockup presets are project-owned canonical data, not opaque asset metadata;
- the optional smart surface is a manual four-corner planar homography, not a PSD Smart Object;
- final raster work belongs in a worker using OffscreenCanvas/WebGL where supported, with a Canvas fallback;
- the smart surface remains feature/capability gated and can never block the core guide/export workflow;
- no displacement maps, generative backgrounds, remote service, or photorealistic-material claim;
- built-in/demo material must be original or clearly redistributable.

## Architecture decision

Reusable presets must survive reload and `.hawya` transfer, so Stage 09 requires a canonical project-schema migration instead of hiding presets inside `asset.metadata`.

Planned schema v2 addition:

```text
HawyaProject
  -> mockups
     -> presets[]
        -> raster background asset reference
        -> normalized crop
        -> optional four-corner smart surface
        -> artwork source (asset or guide page)
        -> opacity / limited blend / limited lighting controls
```

Schema v1 projects migrate sequentially to v2 by adding an empty mockup collection. Existing IndexedDB rows are migrated in memory on repository read and become v2 on the next normal save.

## Geometry

Perspective mapping is expressed as a pure 3×3 homography between a unit artwork square and a normalized convex destination quad. Geometry validation rejects degenerate or self-crossed quads before rendering.

## Rendering

The feature runtime stays lazy. A persistent mockup worker caches decoded image sources by content key and renders previews/final PNGs off the main interaction thread. WebGL is the preferred exact inverse-homography path. Canvas 2D is the deterministic fallback using a subdivided affine mesh.

## Browser research

Current browser platform support makes worker-side OffscreenCanvas and ImageBitmap a reasonable progressive-enhancement target, but capability checks remain mandatory. ImageBitmap resources must be closed/released and no assumption is made that every GPU/context supports the smart path.

## Dependency decision

No new dependency is planned. Existing browser APIs plus small project-owned matrix/geometry code are sufficient and keep the feature within the project's dependency policy.
