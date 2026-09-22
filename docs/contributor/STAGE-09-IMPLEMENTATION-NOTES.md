# Stage 09 Implementation Notes — Mockups & Applications

Date: 2026-09-22  
Branch: `stage-09-mockups`  
PR: #20

## Architecture

Stage 09 keeps the Clean Architecture direction and introduces one intentional canonical schema change:

```text
ProjectSnapshot v2
  -> MockupStudioQuery / ManageMockupPresetsUseCase
  -> MockupRenderer port
  -> lazy Mockup Studio route
  -> persistent worker adapter
  -> OffscreenCanvas WebGL exact warp
     or Canvas 2D mesh fallback
  -> PNG artifact download
```

React owns form/interaction state only. Validation of crop/preset/surface geometry is in the domain/application layers. Dexie, Worker, OffscreenCanvas and WebGL stay in infrastructure.

## Canonical schema and persistence

Project schema moves from v1 to v2 because reusable presets must survive reload and `.hawya` transfer.

The v1→v2 migration adds an empty `mockups.presets` collection without mutating the source. Dexie stores the collection as an unindexed field on the existing project row, so the IndexedDB index version remains unchanged.

A browser/IndexedDB integration test closes and reopens the database and verifies the preset/surface survives intact.

## Standard mockups

Mockup background import is restricted to PNG/JPEG/WebP raster inputs and is ingested through the existing asset security/metadata pipeline as `kind: "mockup"`.

A reusable preset stores:

- background reference;
- normalized crop;
- name and timestamps;
- optional smart surface.

Standard crop/render remains independent from whether the optional smart-surface feature flag is enabled.

## Smart planar surface

The optional smart extension is intentionally narrow:

- one planar four-corner surface;
- artwork source = project asset or guide page;
- homography/perspective warp;
- opacity;
- `normal`, `multiply`, `screen` blend;
- limited shadow and highlight silhouette treatment.

It does not claim PSD Smart Objects, displacement mapping, generative backgrounds or photorealistic material simulation.

The smart control is feature/capability gated and never blocks core Guide/Export routes.

## Geometry

The domain validates a convex, non-self-crossing, non-degenerate quad. A pure 3×3 homography maps the unit artwork square to physical normalized mockup coordinates.

UI RTL does not mirror canvas coordinates. Four-corner handles use physical `left/top` deliberately; surrounding application chrome continues to use logical CSS properties.

## Worker and rendering lifecycle

`WorkerMockupRenderer` owns one lazy persistent worker per Mockup Studio feature runtime and serializes render requests.

The worker:

- receives copied/transferred ArrayBuffers rather than moving IndexedDB-owned byte arrays;
- caches a bounded number of decoded ImageBitmaps by content key;
- closes evicted ImageBitmaps;
- prefers WebGL inverse-homography rendering;
- falls back to a subdivided Canvas 2D affine mesh;
- composites onto the cropped background;
- returns PNG bytes through a transferable ArrayBuffer;
- reports progress and accepts cancellation;
- terminates and resets on the 45-second safety timeout.

The WebGL matrix upload explicitly converts the project row-major matrix to WebGL column-major memory order.

## Guide-page artwork

When a preset uses a guide page instead of an asset, Stage 09 reuses the Stage 08 canonical export scene/raster pipeline. It does not screen-scrape editor DOM.

## UI and accessibility

Mockup Studio is lazy-routed at `/studio/projects/:id/mockups` and linked from Guide Studio.

It provides:

- background upload and preset rail;
- crop numeric fields;
- four drag handles plus numeric X/Y keyboard alternatives;
- artwork selector;
- blend/opacity/shadow/highlight controls;
- save/delete;
- progress/cancel;
- preview and PNG download;
- EN/AR messages;
- explicit capability/non-Photoshop messaging.

## Dependencies and services

- New dependency: **none**.
- Paid/cloud service: **none**.
- Backend/account requirement: **none**.
- Built-in third-party stock mockup asset added: **none**.

Browser platform APIs and project-owned geometry code are sufficient for v1 Stage 09 scope.
