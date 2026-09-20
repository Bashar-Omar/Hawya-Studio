# Stage 04 Completion Record — Brand System and Asset Library

Status: **complete — Stage 04 functional gate is green.**

## Binding scope completed

- logo variants support create, update, remove, primary selection, semantic roles, and stable semantic `assetId` references;
- global color tokens support CRUD, role groups, sRGB HEX input, RGB/HSL/OKLCH derivation, WCAG 2.1 contrast checks, generic suggested CMYK, user-verified CMYK, and print-review state when a verified screen color changes;
- text styles reference global color-token IDs instead of copying color values, so token edits propagate to consumers;
- fonts support local `.ttf`, `.otf`, `.woff`, and `.woff2` ingestion, worker-based analysis, variable-axis metadata, Arabic sample coverage, GSUB/GPOS signals, license-note metadata, browser `FontFace` registration, and local Arabic rendering samples;
- the Asset Library supports import, type/tag filtering, tag updates, stable-ID replacement, usage counts, and reference-safe deletion;
- asset bytes reuse the existing SHA-256 content-addressed binary store; semantic Asset entities remain distinct from deduplicated binary content;
- SVG files are sanitized before persistence with DOMPurify plus Hawya-specific deny/local-reference enforcement;
- executable SVG tags, event handlers, inline/style blocks, non-local href/src values, external CSS `url(...)`, risky URL schemes, external stylesheets, and baseline animation constructs are removed or rejected;
- raster analysis runs in a bounded worker and produces cached WebP preview bytes where supported;
- browser file-size policy is enforced before `File.arrayBuffer()`, then validated again after read at the application ingestion boundary;
- asset and color global reference counts are exposed to the Brand System UI;
- Brand System UI is split into Assets, Logos, Colors, and Typography feature panels and is lazy-loaded from the main application shell;
- English and Arabic remain first-class UI modes; uploaded Arabic fonts are rendered locally without a network font service.

## Architecture decisions changed

None.

ADR-001 through ADR-007 remain accepted and unchanged.

Stage 04 extends Project Schema v1 with the optional `print.verifiedCmykNeedsReview` field. The change is backward-compatible, so no project-format migration or IndexedDB database-version bump is required.

React continues to consume application/runtime boundaries rather than importing Dexie, parsing fonts, or sanitizing SVG directly. Heavy parser/sanitizer work remains behind ports/adapters and worker boundaries.

## Dependencies introduced

- `dompurify@3.4.15` — SVG sanitization; Apache-2.0/MPL-2.0 dual license;
- `colorjs.io@0.7.1` — color conversion and WCAG contrast; MIT;
- `@cantoo/fontkit@2.0.12` — maintained browser-capable font parser fork with TypeScript declarations; MIT.

The detailed dependency review and exit strategies are recorded in `docs/contributor/STAGE-04-DEPENDENCY-REVIEW.md`.

No backend, account system, paid API, cloud database, runtime secret, or required SaaS dependency was introduced.

## Import / security boundaries

The Stage 04 import path is:

1. validate browser-declared file size before reading bytes;
2. read local bytes;
3. enforce hard size policy again;
4. sniff supported file signatures;
5. validate filename/MIME family against detected content;
6. sanitize SVG or analyze font/raster data behind dedicated adapters/workers;
7. hash and store validated/sanitized bytes in the content-addressed binary store;
8. persist the semantic Asset entity only after preparation succeeds.

Font and raster workers are single-concurrency through their adapters and are terminated on a five-second safety timeout.

The final manual security review found and fixed two issues before completion:

- the browser adapter originally read the full File before applying the size policy;
- SVG style blocks and external paint/filter `url(...)` references needed explicit Hawya-side removal in addition to DOMPurify.

Both are now covered by code/tests.

## Gate evidence

Canonical PR: #12 — Stage 04: Brand System and Asset Library.

Final functional CI run before this completion record: `35499274000`.

### Quality gate — passed

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build

Results:

- lockfile/supply-chain policy verification passed;
- Biome formatting verification passed;
- Biome lint passed;
- TypeScript 7 strict typecheck passed;
- Vitest: **17 test files passed, 29 tests passed**;
- production Vite build passed.

Stage 04 unit/integration coverage includes:

- global color-token propagation through ID-based text-style references;
- stable AssetId replacement while preserving logo references;
- asset magic-byte/type/size policy;
- oversized browser File rejection before byte reading;
- all prior Stage 00–03 persistence, archive, lifecycle, migration, routing, preferences, and i18n tests remain green.

### Chromium gate — passed

    pnpm build
    pnpm test:browser

Result: **14 passed**.

The browser suite verifies all prior shell/project-library/setup behavior plus Stage 04 critical paths:

- malicious SVG input is sanitized before it becomes a project asset and cannot execute script/event-handler content;
- SVG style blocks, external href references, and external CSS paint/filter URL attempts are identified and stripped/rejected by policy;
- replacing a logo asset changes its bytes/filename while preserving the semantic logo reference and usage relationship;
- an uploaded Noto Sans Arabic WOFF2 fixture is parsed, registered via `FontFace`, reported with Arabic coverage, and verified by `document.fonts.check(...)` while rendering Arabic text locally.

The Arabic test fixture comes from the already-pinned Fontsource package at test time; no standalone font binary was added to the repository or handoff.

## Manual checks

- reviewed the browser-file → application-ingestor → sanitizer/analyzer → binary-store ordering against the Project Pack import-security contract;
- reviewed ownership-vs-consumer asset reference counting and confirmed the top-level `assetRefs` ownership reference is intentionally excluded from the UI usage count while still protecting deletion;
- reviewed stable-ID asset replacement and post-save reference-safe garbage collection;
- reviewed font parser output validation so no Fontkit object crosses into canonical domain state;
- reviewed build chunking to confirm Stage 04 feature UI, DOMPurify, the raster worker, and the font worker are emitted separately from the initial route where practical.

## Known limitations / deliberate deferrals

- Stage 04 manages the canonical Brand System; semantic guide-page generation and template families belong to Stage 05;
- the complete advanced editor/canvas belongs to Stage 06, so Stage 04 font rendering is demonstrated in Brand System samples rather than a full editor surface;
- Arabic coverage is a deterministic sampled glyph-coverage warning plus GSUB/GPOS signals, not a claim about typographic quality;
- generic CMYK values are suggestions only. Verified print separation stays user-owned and is never silently overwritten;
- TTC/DFont collection ingestion is not exposed by the Stage 04 file picker; supported upload formats are TTF/OTF/WOFF/WOFF2;
- raster `hasAlpha` metadata is currently format-informed rather than a per-pixel transparency proof;
- Vite still reports the initial `index` JavaScript chunk at about **641 kB minified**, above the default 500 kB warning threshold. Stage 04 avoids putting its heavy parser/sanitizer work into that route where practical, but the remaining application-shell chunk debt is intentionally not hidden by raising the warning limit and remains a performance item for later profiling/Stage 10;
- Vercel production project/linkage remains an external deployment task and is not claimed complete here.

## Next-stage readiness

**Stage 05 may begin after this completion record receives a final green PR-head CI run and PR #12 is squash-merged to `main`.**

Stage 05 — Guide Generator and Templates must start from the merged Stage 04 main snapshot plus the binding Hawya Studio Project Pack.

Its gate requires compatible template switching without loss of semantic PageContent and live page updates when Brand System tokens change.
