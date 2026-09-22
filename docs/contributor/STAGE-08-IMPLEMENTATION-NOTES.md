# Stage 08 Implementation Notes — Export System

Date: 2026-09-22  
Branch: `stage-08-exports`  
PR: #19

## Architecture

Stage 08 keeps the existing Clean Architecture direction:

```text
ProjectSnapshot
  -> ExportWorkspaceQuery (validate + deep-freeze + binary inventory + Stage 07 audit)
  -> target-aware export preflight
  -> application ExportRenderer ports
  -> infrastructure renderers / worker adapters
  -> Export Center or dedicated Print View
  -> browser-owned files
```

Domain export contracts do not depend on React, Dexie, Canvas DOM, or a concrete ZIP/font library.

## Implemented outputs

- `.hawya` portable project backup;
- editable-text SVG;
- outlined SVG through Fontkit;
- PNG;
- WebP;
- JPEG;
- Browser Print / Save as PDF workflow;
- Design Tokens JSON;
- CSS Variables;
- `brand-guidelines.md`;
- self-contained Static Web Guide ZIP;
- selectable Delivery ZIP.

No native Adobe format is generated or mislabeled.

## Export contracts and preflight

`src/domain/export/export-contract.ts` defines format IDs, font policy, artifacts, fidelity contracts and the generic renderer port.

`runExportPreflight` combines Stage 07 audit evidence with export-specific rules. High-value formats block on unresolved critical assets/schema/font requirements; `.hawya` remains an emergency portability path for schema-valid projects.

The preflight now also verifies that every rendered text-style font reference resolves to an actual brand font record.

## Scene and typography projection

`resolveExportScene` adapts the editor's pure rendered scene to export typography without reading the live DOM.

Text style selection is deterministic:

- brand/page titles: display -> h1 -> body -> first style;
- headings: h2 -> h1 -> body -> first style;
- ordinary template text: body -> first style;
- extra text layers preserve their explicit text-style token.

Color tokens, font metadata, OpenType features, weight/style, size, line height and letter spacing are projected into export styles.

## SVG

Editable SVG keeps text as `<text>/<tspan>`, vectors/shapes remain vector, and project assets are embedded from validated stored binaries.

Outlined SVG uses the same scene but resolves every text run through the font-outline port. Multi-page selection produces independent SVG artifacts rather than inventing a non-standard multi-page SVG.

Generated markup escapes text/attributes and does not inline arbitrary project HTML.

## Font worker

`WorkerFontOutliner` owns one lazy worker per Export Center runtime. It:

- transfers the font binary only when a font key is first used;
- reuses parsed Fontkit font objects inside the worker;
- caches a bounded number of outline results;
- has per-request safety timeouts;
- aborts/terminates cleanly when export runtime is disposed.

## Raster worker

Raster export first creates outlined SVG scene data, then sends rasterization to the export raster worker. The UI exposes scale, exact pixel preview, quality and flatten/background options. Pixel count is validated before render.

## Archive worker and packages

The archive packager worker creates deterministic ZIP entries with safe internal paths.

Static Web Guide contains hostable relative-path files and no backend/editor runtime.

Delivery ZIP can include/exclude guidelines, artwork, logos, colors, developer outputs, fonts and source attachments. Font binaries are only included after explicit `include-confirmed` policy. The manifest and README include export metadata and fidelity/license notes.

## Print View

The dedicated print route renders without `AppShell`/editor chrome, registers project fonts, waits for `document.fonts.ready` plus image readiness, exposes a `data-print-ready` acceptance marker, and uses print CSS / page sizing.

## UI

Export Center is lazy-loaded and groups outputs into documents, artwork, web, developer and delivery categories. It includes:

- explicit fidelity/limitation copy;
- locale selection;
- page selection;
- preflight blockers/warnings;
- warning acknowledgement;
- raster controls;
- delivery category tree;
- font policy;
- progress status;
- cancellation with `AbortController`.

EN and AR messages were added for Stage 08 surfaces.

## Tests

Stage 08 adds or extends:

- preflight tests, including orphan font references;
- physical-unit raster dimension tests;
- SVG structural/group/fidelity tests;
- package renderer/manifest tests;
- EN, AR and bilingual semantic golden tests;
- route tests;
- full Chromium critical-path E2E for tokens, Delivery ZIP, real Fontkit outlined SVG and Print View.

The browser E2E intentionally validates downloaded artifacts (manifest/ZIP/SVG), not only transient checkbox state.

## Persistence / schema / dependencies

- Project schema bump: **none**.
- Migration: **none**.
- New runtime dependency: **none**.
- New paid/cloud service: **none**.

Stage 08 exports projections of the existing canonical model and does not persist export-derived state.
