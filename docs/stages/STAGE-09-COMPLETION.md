# Stage 09 Completion Report — Mockups & Applications

Date: 2026-09-22  
Stage: 09 — Mockups & Applications  
PR: #20  
Product-code verification head: `bb6eaab4d83565642861efc4705f75d60b57fcd2`  
Product-code verification run: `35743901850`  
Documentation-head verification: `f111802bdd6a76b4f3d87ed9495cdaab86311205` / run `35744275580`

## Result

Stage 09's binding Mockups & Applications scope is implemented.

Hawya now supports reusable uploaded raster mockups, normalized crop/placement, an optional feature-gated four-corner planar smart surface, canonical artwork binding, deterministic worker-side rasterization and PNG download without introducing PSD-native claims, paid services, remote processing or random stock assets.

## Binding gate checklist

- [x] Uploaded PNG/JPEG/WebP mockup backgrounds use the existing validated asset-ingestion pipeline.
- [x] Standard reusable mockup presets store a raster background reference plus normalized crop.
- [x] Standard mockup rendering remains independent from the optional smart-surface flag.
- [x] Smart planar surface is feature/capability gated.
- [x] Four physical corner controls exist with pointer handles and numeric keyboard-accessible alternatives.
- [x] Artwork may bind to a valid project asset or canonical guide page.
- [x] Pure domain homography validates convex, non-self-crossing, non-degenerate quads.
- [x] Worker-side rasterization prefers WebGL and falls back to Canvas 2D.
- [x] Opacity plus limited `normal` / `multiply` / `screen` blend, shadow and highlight controls exist.
- [x] Preview, progress, cancellation and PNG download exist.
- [x] Reusable presets survive IndexedDB close/reopen.
- [x] Non-empty smart presets survive `.hawya` archive encode/decode.
- [x] Mockup asset references participate in project reference counting and delete safety.
- [x] UI is available in EN and AR.
- [x] RTL UI changes do not mirror physical mockup X/Y coordinates.
- [x] Existing editor image layers gained explicit fit/crop editing for standard placement parity.
- [x] No built-in third-party stock mockup was added.
- [x] No PSD Smart Object, displacement-map, generative-background or photorealistic-material claim was added.

## Files changed

Product, tests and project-format documentation touch 49 files before this completion report and README status update.

The Stage 09 work spans:

- canonical project schema/migration/persistence;
- mockup domain geometry and application use cases;
- editor image crop/fit parity;
- lazy Mockup Studio route/UI;
- worker protocol/renderer and WebGL/Canvas implementation;
- EN/AR UI messages;
- unit, IndexedDB, archive and Chromium coverage;
- contributor and project-format documentation.

## Architecture decisions

New ADR: **none**.

Stage 09 follows the existing Clean Architecture direction:

```text
ProjectSnapshot v2
  -> MockupStudioQuery / ManageMockupPresetsUseCase
  -> MockupRenderer port
  -> lazy Mockup Studio feature runtime
  -> persistent mockup worker adapter
  -> WebGL inverse-homography renderer
     or Canvas 2D mesh fallback
  -> PNG artifact
```

React owns interaction/draft state. Canonical validation, reference integrity and geometry rules remain outside React. Dexie, workers, OffscreenCanvas and WebGL remain infrastructure concerns.

Guide-page artwork reuses the Stage 08 canonical export scene/raster path; no editor DOM scraping was introduced.

## Schema and persistence impact

Canonical project schema: **v1 → v2**.

Schema v2 adds `project.mockups.presets[]` containing:

- stable preset ID/name/timestamps;
- raster background `AssetId`;
- normalized crop;
- optional smart surface;
- physical normalized corner coordinates;
- asset/page artwork source;
- limited visual controls.

Migration `v1 → v2` is sequential and non-mutating and adds an empty mockup collection. It does not invent presets from existing images.

IndexedDB physical table/index version: **unchanged**. The mockup collection is an unindexed field on the existing project row and is passed through the canonical migration/validation boundary when reloaded.

Archive format version: unchanged; the canonical project payload carries schema v2 and the existing archive codec/migration pipeline validates it.

## Automated verification

Product-code GitHub Actions run `35743901850` on head `bb6eaab4d83565642861efc4705f75d60b57fcd2`:

### Quality gate

- formatting: PASS
- Biome lint: PASS
- TypeScript strict: PASS
- unit/integration tests: **30 files / 78 tests PASS**
- production build: PASS

Stage 09-specific automated coverage includes:

- homography mapping/inversion/invalid-quad cases;
- mockup preset create/update/remove and reference integrity;
- raster-background and artwork-reference validation;
- IndexedDB close/reopen round-trip for a smart preset;
- non-empty smart-preset `.hawya` archive encode/decode;
- route matching;
- EN/AR/UI integration through the browser path.

### Chromium gate

- **26 / 26 tests PASS**
- elapsed browser suite: **51.7s**
- Stage 09 critical path covers:
  - project creation;
  - artwork raster import;
  - navigation through Guide Studio into Mockup Studio;
  - mockup background import;
  - normalized crop edit and standard preset save;
  - smart-surface enablement;
  - four-corner numeric editing;
  - blend/opacity editing;
  - save/reload persistence;
  - preview render through WebGL or Canvas fallback;
  - PNG download and signature verification;
  - EN→AR UI direction switch with physical X coordinate preserved;
  - no Hawya console warning/error in the tested Stage 09 path.

No Playwright timeout threshold was raised to obtain the green gate.

## Security / reliability review

A PR-wide added-code scan was performed before completion documentation:

- no `TODO/FIXME/HACK` debt added;
- no TypeScript/Biome suppression added;
- no `dangerouslySetInnerHTML`;
- no `eval` / `new Function`;
- no new `fetch` / XHR / WebSocket / remote URL dependency;
- no workflow changes;
- no `package.json` or `pnpm-lock.yaml` changes;
- no new dependency;
- no paid/cloud/backend requirement;
- no unresolved PR review thread at the product-code gate.

Existing SVG sanitization remains the boundary for vector artwork. Mockup backgrounds are restricted to recognized raster images. Worker output is capped at 40 megapixels and decoded ImageBitmap caching is bounded with eviction/close behavior.

## Bugs found and fixed during the gate

### React event lifetime in smart controls

Chromium E2E exposed smart-control handlers reading `event.currentTarget.value` inside deferred functional state updaters. The event target is not a safe deferred dependency.

Opacity, blend, shadow, highlight and four-corner handlers now capture primitive values synchronously before invoking the state updater.

### WebGL matrix memory order

The project homography representation is row-major while WebGL uniform matrices consume column-major memory order. The inverse homography is now transposed explicitly before `uniformMatrix3fv`.

### Standard-vs-smart capability boundary

The smart feature flag initially risked disabling ordinary mockup rendering. Runtime capability is now split into `renderSupported` and `smartSupported`, so optional smart gating does not disable the standard uploaded-mockup workflow.

### E2E fixture state

The Stage 09 browser fixture originally assumed a generated-guide heading after intentionally skipping guide generation. The browser path now asserts the actual available Mockups navigation from the valid empty-guide state instead of masking the mismatch with direct routing.

## Performance evidence and Stage 10 carry-forward

Stage 09 preserves lazy route/worker boundaries:

- Mockup Studio JS: ~**17.90 kB** minified / ~**5.59 kB** gzip;
- Mockup Studio CSS: ~**3.66 kB** / ~**1.13 kB** gzip;
- mockup worker: ~**103.19 kB** isolated worker output.

The existing initial app bundle is now ~**747.48 kB** minified / ~**228.99 kB** gzip and Vite still emits its default >500 kB chunk warning. The warning was intentionally **not** suppressed and the threshold was **not** raised.

Startup/bundle profiling, representative-scale stress testing, PWA/offline hardening and broader accessibility work remain explicit Stage 10 gates.

## Known honest limitations

- Smart mockups support one planar four-corner surface, not arbitrary curved/material deformation.
- WebGL availability depends on browser/GPU/context; Canvas 2D is the supported fallback.
- The Canvas fallback approximates the homography with a subdivided affine mesh rather than claiming GPU-identical output.
- Shadow/highlight are limited silhouette treatments, not physical lighting simulation.
- Output is screen-oriented PNG raster.
- No PSD Smart Objects, PSD parsing, displacement maps, generative backgrounds or photorealistic material simulation.
- No remote AI/rendering service is required.

## Final handoff gates

The product-code gate and documentation-head gate are green. The remaining release mechanics are intentionally performed after this report is committed:

1. mark PR #20 ready and squash-merge it with expected-head protection;
2. verify CI on the exact merged `main` SHA;
3. generate the downloadable Stage 09 ZIP from that exact merged SHA;
4. independently verify checksum, archive integrity, tracked entries and critical Git blobs.

The exact merged SHA and handoff checksum are recorded in the external Stage 09 handoff verification file produced from GitHub after merge.

Stage 10 — Performance, PWA, Offline & Accessibility Hardening — is next after the verified handoff.
