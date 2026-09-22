# Stage 08 Research Notes — Export System

Date: 2026-09-22  
Stage: 08 — Exports

## Binding sources

Stage 08 was implemented against the current Hawya Project Pack export, architecture, engineering, security, performance and QA documents, especially:

- `06-export/EXPORT-OVERVIEW.md`
- `06-export/SVG-EXPORT.md`
- `06-export/PDF-EXPORT.md`
- `06-export/RASTER-EXPORT.md`
- `06-export/DEVELOPER-AND-MACHINE-EXPORTS.md`
- `06-export/WEB-GUIDE-EXPORT.md`
- `06-export/DELIVERY-ZIP.md`
- `06-export/NATIVE-FORMAT-LIMITATIONS.md`
- `03-architecture/adrs/ADR-006-EXPORT-STRATEGY.md`
- `08-engineering/WORKERS.md`
- `12-qa/EXPORT-GOLDEN-FILES.md`
- `12-qa/PERFORMANCE-BUDGETS.md`
- `09-implementation/stages/STAGE-08-EXPORTS.md`
- `09-implementation/DEFINITION-OF-DONE.md`

No new ADR was required. The Stage 08 implementation follows ADR-006 and the existing local-first / Brand-System-source-of-truth decisions.

## Decisions confirmed during implementation

### 1. Immutable canonical snapshots are the only export source

Export does not scrape editor DOM. `ExportWorkspaceQuery` loads one canonical `ProjectSnapshot`, validates it, deep-freezes it, resolves binary availability, and builds the Stage 07 audit once. Renderers receive that immutable snapshot plus explicit options and an `AbortSignal`.

This keeps export reproducible and prevents editor interaction state from becoming file-format state.

### 2. Preflight is target-aware and consumes Stage 07 audit

Project-wide correctness continues to live in the audit engine. Stage 08 converts relevant audit findings into target-specific blocking/warning results and adds export-only checks such as:

- schema validity;
- page dimensions;
- font policy;
- text-style coverage for rendered-font outputs;
- text-style-to-font reference validity;
- binary availability.

The emergency `.hawya` backup intentionally stays available for schema-valid projects even when semantic/editor warnings exist, while high-value artwork/package exports remain stricter.

### 3. Fidelity is explicit, not implied

Every export format has an explicit fidelity contract. In particular:

- editable SVG keeps live text and therefore needs the receiving environment to have matching fonts;
- outlined SVG preserves appearance by converting glyphs to paths and intentionally loses editable/searchable text;
- PNG/WebP/JPEG are browser RGB raster outputs;
- Browser Print / Save as PDF is RGB-oriented and is not PDF/X or press-ready CMYK;
- Hawya core does not generate native `.ai`, `.indd`, or `.psd`.

### 4. Font outlining stays behind a worker boundary

The existing `@cantoo/fontkit` dependency is reused; Stage 08 adds no new dependency. Font parsing and glyph outline extraction happen in `font.worker.ts`.

A persistent lazy `WorkerFontOutliner` is reused across one Export Center lifetime. The worker caches parsed fonts by key and the adapter keeps a bounded outline-result cache. This avoids the anti-pattern of starting one worker and re-parsing Fontkit for every text line. Transferable `ArrayBuffer` ownership is used when the font binary first enters the worker.

### 5. Typography fallback is semantic and deterministic

Template text asks for its preferred semantic role first. If a project has a smaller typography system, template title/heading resolution falls back to the body style and then the first available style rather than silently switching to an unrelated browser font.

Preflight blocks orphaned text-style font references before render.

### 6. Raster output is scene-derived, not a UI screenshot

Raster export uses an outlined SVG scene snapshot and browser/worker raster APIs. It supports:

- page selection;
- 1x / 2x / 3x / custom scale;
- physical-unit-to-pixel math;
- pixel dimension preview;
- JPEG/WebP quality;
- background flattening;
- a hard pixel safety cap rather than unbounded tab memory use.

### 7. Print View is a dedicated renderer surface

The print route renders canonical scene output without editor chrome. It waits for font and image resources before exposing the print action and uses CSS paged-media sizing. The contract remains Browser Print / Save as PDF, not a fake direct PDF engine.

### 8. Packages are deterministic and user-owned

Archive work is isolated behind an archive worker/port. Static Web Guide output is self-contained, uses relative assets, contains no Hawya backend dependency or analytics, and escapes user text.

Delivery ZIP has an explicit selection tree and an explicit font-binary licensing policy. Its manifest/README records the project/schema, selected categories, export timestamp, Hawya version, font policy and fidelity notes.

### 9. Golden strategy is semantic

Graphics bytes are not used as the only truth. Stage 08 tests dimensions/viewBox, stable layer IDs, text-vs-path behavior, unsafe SVG constructs, package membership/manifest contracts, and EN/AR/bilingual locale semantics.

## Research-driven implementation corrections

Browser E2E exposed two issues that were fixed at the product layer rather than hidden with timeouts:

1. React checkbox handlers read `event.currentTarget.checked` from inside deferred functional state updaters. After the event handler returned, `currentTarget` could be null. The checked value is now captured synchronously before the updater.
2. Template title/heading layers could fail outlined export when a project only had a body text style. The resolver now uses the documented semantic fallback chain and preflight rejects orphaned font references.

## Performance observation

The final product-code build kept export surfaces split from the initial route:

- Export Center chunk: about 50.00 kB minified / 15.26 kB gzip;
- Print View chunk: about 6.06 kB / 2.52 kB gzip;
- Font worker: about 379.98 kB and isolated from startup.

The existing main bundle remains about 735.10 kB minified / 225.46 kB gzip and still triggers Vite's default chunk warning. The warning was not suppressed or threshold-raised; bundle work remains a Stage 10 performance task.
