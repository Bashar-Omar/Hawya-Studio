# Stage 06 Completion Record — Advanced Editor Core

Status: **complete pending final documentation-head CI, merge, merged-main CI, and handoff packaging.**

## Files changed

Stage 06 changes **36 repository files** relative to the merged Stage 05 baseline once this completion record and README status update are included.

- application shell / routing: `src/app/App.tsx`, app metadata, route parser and route tests;
- editor application boundary: `src/application/editor/editor-session.ts` and `editor-session-factory.ts`;
- pure editor model/geometry/history/scene modules under `src/editor/`;
- runtime-validated clipboard model in `src/editor/model/editor-clipboard.ts`;
- Moveable infrastructure adapter in `src/infrastructure/editor/moveable-transform-adapter.ts`;
- runtime composition in `src/infrastructure/runtime/create-persistence-runtime.ts`;
- retained editor UI under `src/features/editor/` plus Guide Studio edit-page integration;
- EN/AR editor copy and accessibility labels;
- Project Schema Stage 06 persistence-boundary documentation;
- Stage 06 dependency, implementation, and research notes;
- unit/integration coverage in `src/editor/stage06-editor-core.test.ts`;
- Chromium EN/AR/performance coverage in `tests/e2e/stage06-editor-core.spec.ts`;
- dependency manifest/lockfile updates for Moveable and Immer;
- README and this completion record.

## Binding scope completed

- document-unit canvas viewport with zoom, pan, fit-page, 100% view, keyboard zoom, and physical page coordinates;
- retained DOM/SVG scene projection for template-owned and extra text/image/vector/shape/group layers;
- Moveable adapter for drag, single-layer resize, and single-layer rotate without persisting CSS matrix strings;
- selection, Shift multi-select, marquee selection, primary selection, layer tree, visibility, and locking;
- transient drag/resize/rotate frames remain in memory and pointer end commits one logical command plus one repository save;
- no-op geometry commands create no Immer patch history entry and no persistence write;
- bounded session undo/redo through Immer patches/inverse patches with command labels, 200-entry target and 2 MiB estimated patch budget;
- pure document-coordinate alignment, distribution, and snapping;
- snapping to page edges/centers, page margins, visible unlocked layer bounds/centers, and template-layer bounds, with a persisted global toggle and temporary Alt/Option disable;
- inline DOM textarea text editing with semantic `lang` / `dir` and browser-native bidi/Arabic shaping;
- numeric inspector geometry editing with intermediate string state and blur/Enter commit;
- duplicate, internal copy/paste, delete, lock/hide, and simple group/ungroup basics;
- browser clipboard JSON is runtime-validated with Zod against the canonical `layerSchema` before it can reach editor commands;
- searchable, platform-aware keyboard-shortcut dialog and EN/AR editor/accessibility labels;
- Guide Studio opens generated pages in the lazy-loaded Advanced Editor route;
- physical document geometry is invariant when the application UI switches between LTR and RTL.

## Architecture decisions changed

None.

ADR-004 remains the governing editor decision: DOM/SVG retained-mode rendering with browser-native text plus Moveable as an interaction adapter.

The Stage 06 flow is:

```text
GuidePage + BrandSystem
  -> pure scene projection
  -> EditorSession application service
  -> retained React DOM/SVG canvas
  -> Moveable interaction adapter
```

Canonical state remains typed document-unit geometry in `GuidePage`. Moveable screen deltas are converted back into document units before commit. Template-owned scene edits use the existing validated `GuidePage.localOverrides` extensibility envelope, while extra layers remain in `GuidePage.extras`. Semantic PageContent introduced in Stage 05 is not rewritten by editor layout operations.

Selection, primary selection, viewport, marquee, temporary transform previews, snap guides, and undo/redo stacks remain session state and are not serialized into project archives.

No IndexedDB/database implementation is imported into editor domain/model/geometry code.

## Dependencies introduced

### `react-moveable@0.56.0`

- reviewed current package release;
- MIT licensed with TypeScript declarations;
- isolated to the editor interaction layer;
- canonical project state does not depend on Moveable/CSS transform strings;
- adapter isolation leaves a replacement path without changing project schema.

### `immer@11.1.18`

- reviewed current package release;
- MIT licensed and has no runtime dependencies according to current npm metadata;
- `enablePatches()` is called explicitly before patch APIs;
- history implementation is isolated under `src/editor/history/`;
- patch stacks are session-only and memory-bounded.

No backend, account system, paid API, cloud database, runtime secret, or new state-management framework was introduced.

## Persistence and trust boundaries

The editor writes only canonical project data:

- final document-unit transforms;
- extra layers;
- validated template local overrides;
- global snap setting;
- semantic text edits.

It does **not** persist pointer-frame state, CSS matrices, selection, viewport, marquee, snap guides, or Immer history.

External browser clipboard text is untrusted. `parseEditorClipboardJson()` parses JSON and validates the full payload through the canonical Zod layer schema. Malformed or structurally invalid payloads are ignored rather than cast into the command layer.

## Gate evidence

Canonical PR: #16 — Stage 06: Advanced Editor Core.

Final functional product-code CI before documentation: **run `35587871660`**.

Product-code head under that run: `2b6f3dddca9fd6260ef2ba2ca2958b1da65845d3`.

### Quality gate — passed

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build

Environment and results:

- Node **24.21.0**;
- pnpm **12.4.2**;
- Biome format verification passed;
- Biome lint passed;
- TypeScript **7.0.2** strict typecheck passed;
- Vitest: **20 test files passed, 48 tests passed**;
- production Vite build passed.

Stage 06 editor-core coverage includes:

- 120 pointer-preview frames with zero extra repository writes until one transform commit;
- undo/redo persistence and labeled Immer history;
- history count and memory bounds;
- no-op transform produces no history growth and no persistence write;
- document-coordinate align/distribute/snap behavior and snap disable;
- Moveable screen-pixel to canonical document-unit conversion;
- simple group/ungroup preserving world-space appearance;
- physical x-coordinate invariance between Arabic and English rendering;
- global snap setting persisted outside page history;
- malformed clipboard JSON rejected while canonical layer payloads validate.

All existing Stage 00–05 tests remain green.

### Chromium gate — passed

    pnpm build
    pnpm test:browser

Result: **18 passed**.

The Stage 06 Chromium paths verify:

- an English project can generate a guide, open the editor, create and drag a layer, undo, redo, save, reload, and retain final geometry;
- an Arabic-content page uses semantic RTL text, keeps physical x coordinates unchanged when the UI switches to RTL, persists edited Arabic text and geometry through undo/redo and reload;
- the editor samples requestAnimationFrame intervals during a sustained drag and enforces at least 15 samples, median below 30 ms, and p95 below 60 ms in CI as a regression proxy for the 60fps target;
- both Stage 06 critical paths fail if Hawya emits browser `console.error`, `console.warning`, or an uncaught `pageerror`.

## Manual checks

- re-read the current uploaded Project Pack Stage 06 contract, Editor Engine, History/Undo/Redo rules, RTL specification, performance budgets, and Definition of Done before closure;
- confirmed `x = 0` remains the physical left edge and page geometry uses physical `left/top` while UI chrome uses logical RTL-aware CSS;
- confirmed Moveable is an adapter only and no CSS matrix/transform string becomes canonical project data;
- confirmed pointer-frame previews stay out of repository persistence and final pointer-up is one logical command;
- confirmed no-op normalized geometry is filtered before an Immer mutation can be produced;
- confirmed history is session-only, command-labeled, count-bounded, and memory-budgeted;
- confirmed rotated distribution is rejected with an EN/AR user message rather than silently applying unsupported geometry;
- confirmed simple groups preserve world position on group/ungroup and group resize/rotate controls are intentionally disabled until nested-transform golden coverage exists;
- confirmed browser clipboard JSON is runtime-validated rather than trusted through a TypeScript cast;
- confirmed editor visible text, shortcut labels, and editor accessibility labels use EN/AR messages;
- reviewed the PR tree for `.stage06`, bootstrap/materializer, generated build, coverage, and browser-test artifacts; transport files are no longer part of the source branch;
- reviewed Stage 06 scope to ensure Stage 07 smart engines/audit logic and Stage 08 export work were not pulled forward.

## Performance evidence

The Stage 06 editor is lazy-loaded.

Functional build evidence from run `35587871660`:

- Editor CSS: about **7.32 kB minified / 2.00 kB gzip**;
- Editor JS lazy chunk: about **265.97 kB minified / 85.36 kB gzip**;
- initial `index` JS: about **695.66 kB minified / 213.95 kB gzip**.

Vite's default >500 kB warning remains visible. The warning is not hidden by increasing `chunkSizeWarningLimit`.

The browser frame-pacing test is a CI regression signal, not a claim that every device will sustain a perfect 60fps under every project scale. Representative mid-range-hardware profiling remains part of later performance hardening.

## Known limitations / deliberate deferrals

- Stage 06 groups are intentionally **simple and move-only as a group**. Group resize/rotate and arbitrary nested transform composition are deferred until golden tests cover nested rotation/scale;
- distribution is intentionally limited to **unrotated bounding boxes**;
- undo/redo history does not survive reload in v1 by design; canonical saved state does;
- the current clipboard feature copies Hawya layer JSON and has an in-session fallback; direct OS bitmap/file clipboard ingestion into new Asset records is not part of this Stage 06 basic scope;
- snapping covers page, margin, layer, and template-layer geometry; a separate user-authored guide-management feature is not introduced here;
- the rAF performance assertion is a CI proxy and not a universal hardware benchmark;
- the initial application bundle remains above Vite's 500 kB warning threshold and needs continued profiling/code-splitting work in the performance stage;
- Vercel production linkage remains an external deployment task and is not claimed complete here.

## Next-stage readiness

**Stage 07 — Smart Engines and Audit may begin only after this completion record and README update receive a final green PR-head CI run, PR #16 is squash-merged to `main`, merged `main` itself is green, and a verified full Stage 06 handoff ZIP is generated from that merged commit.**

Stage 07 must preserve the Stage 06 invariants that canonical geometry is document-unit based, UI direction never mirrors document coordinates, pointer interaction libraries remain adapters, and editor history remains separate from project archive state.
