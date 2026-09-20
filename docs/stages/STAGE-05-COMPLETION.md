# Stage 05 Completion Record — Guide Generator and Templates

Status: **complete — Stage 05 functional gate is green.**

## Files changed

Stage 05 changed **33 repository files** relative to the merged Stage 04 baseline.

- application shell / routing metadata: `src/app/App.tsx`, `src/app/app-metadata.ts`;
- semantic guide domain: `src/domain/guide/guide-binding-resolver.ts`, `guide-status.ts`, `page-catalog.ts`, `page-content.ts`;
- declarative template domain: `src/domain/templates/builtin-template-catalog.ts`, `template-definition.ts`, `template-engine.ts`, and template-engine tests;
- canonical project/settings compatibility: `src/domain/project/hawya-project.ts`, `docs/project-format/PROJECT-SCHEMA.md`;
- application layer: guide query plus generate/switch/reset use cases and Stage 05 integration tests;
- runtime composition: `src/infrastructure/runtime/create-persistence-runtime.ts`;
- Guide Studio UI: page, preview component, and feature CSS under `src/features/guide-studio/`;
- setup hardening discovered by browser tests: `src/features/new-project/NewProjectPage.tsx`;
- EN/AR copy: `src/i18n/messages/en.ts`, `src/i18n/messages/ar.ts`;
- browser/golden coverage: `tests/e2e/stage05-guide-templates.spec.ts` and EN/AR/bilingual/stress fixtures under `tests/golden/stage05/`;
- documentation/status: README, Stage 05 implementation/research notes, and this completion record.

## Binding scope completed

- semantic guide content is separated from visual layout through the explicit `hawya.page-content.v1` PageContent contract;
- the stable semantic catalog contains **65 page types** across overview, strategy, logo, color, typography, bilingual, grid, visual-language, imagery, iconography, illustration, graphic-device, application/mockup, digital-token, and delivery/preflight concerns;
- every stable semantic page type can create valid PageContent even when no built-in visual template ships for that type yet;
- Minimal, Standard, Comprehensive, and Custom guide generation modes are implemented;
- profile generation removes pages that are impossible or meaningless for missing Brand System data rather than inventing filler content;
- explicitly requested Custom pages remain present with deterministic `Needs input` state when required semantic data is missing;
- built-in **Essential**, **Editorial**, and **Grid** families ship as versioned, source-controlled declarative templates for the initial representative page set;
- EN, AR, and bilingual template modes are supported, including side-by-side EN/AR, stacked EN→AR, stacked AR→EN, and mirrored editorial arrangements;
- template slots resolve through an explicit binding allow-list; templates do not execute JavaScript or arbitrary property expressions;
- guide generation reads the real canonical Brand System and stores semantic page content plus declarative template bindings;
- Brand System values are resolved at query/render time so changing a global token updates guide consumers without rewriting PageContent;
- template switching validates page type and locale compatibility, rebinds slots, and preserves PageContent, extras, and local overrides;
- Reset Layout reapplies current template binding and canvas geometry, preserves semantic PageContent/extras, and clears layout-local overrides;
- missing required bindings surface as `Needs input`; incomplete but present data can surface as `Review`; complete projections surface as `Generated`;
- English, Arabic, bilingual, and long bilingual stress golden fixtures are committed;
- Guide Studio is lazy-loaded and remains a declarative preview/generator surface rather than pre-implementing the Stage 06 freeform editor.

## Architecture decisions changed

None.

ADR-001 through ADR-007 remain accepted and unchanged.

The core split remains:

```text
Semantic Page Type + PageContent != Visual Template Variant
```

Stage 05 extends Project Schema v1 only with the optional `settings.guideLocaleMode` field and semantic `hawya.page-content.v1` records inside the already-existing guide-page content envelope. Existing Stage 04 project snapshots remain readable, so no project-format migration or IndexedDB database-version bump is required.

React continues to consume application/query/runtime boundaries. Template selection and binding live in domain/application modules; persistence remains behind repositories; no browser/database implementation leaks into the semantic guide model.

## Dependencies introduced

None.

Stage 05 uses the existing React/Vite/Zod/Vitest/Playwright stack. No backend, account system, paid API, cloud database, runtime secret, template-expression runtime, or remote template marketplace dependency was introduced.

Current research notes for bidi/direction semantics and feature-boundary code splitting are recorded in `docs/contributor/STAGE-05-RESEARCH-NOTES.md`.

## Template and binding security boundary

Built-in templates are trusted source-controlled declarative application data.

The Stage 05 binding path is:

1. choose semantic page type and locale mode;
2. resolve a compatible built-in template definition;
3. map known template slot roles through the fixed `ContentBinding` allow-list;
4. resolve values from canonical project/Brand System state at query time;
5. render typed resolved values into the preview surface.

No `eval`, `new Function`, dynamic template JavaScript, remote template code, or arbitrary object-path execution is used.

## Gate evidence

Canonical PR: #14 — Stage 05: Guide Generator and Templates.

Final functional CI run before this completion record: `35503257560` on PR head `cd0fd68ce5273a3afddb64d430841462555dd968`.

### Quality gate — passed

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build

Results:

- frozen lockfile install passed on Node 24.21.0 / pnpm 12.4.2;
- Biome formatting verification passed;
- Biome lint passed;
- TypeScript 7 strict typecheck passed;
- Vitest: **19 test files passed, 39 tests passed**;
- production Vite build passed.

Stage 05 unit/integration coverage includes:

- all **65** stable semantic page types can construct valid `hawya.page-content.v1` PageContent;
- compatible template resolution and fixed semantic slot binding;
- English, Arabic, bilingual, and long-text golden samples;
- switching visual template families without losing semantic content;
- Reset Layout restoring template geometry while preserving PageContent/extras and clearing layout-local overrides;
- generated guide pages resolving live global color-token edits without rewriting the page;
- all prior Stage 00–04 persistence, security, archive, lifecycle, Brand System, migration, routing, preferences, and i18n tests remain green.

### Chromium gate — passed

    pnpm build
    pnpm test:browser

Result: **16 passed**.

The browser suite verifies all prior shell/project-library/setup/Brand System behavior plus Stage 05 critical paths:

- a real project generates a guide from canonical Brand System data;
- a bilingual guide page switches to a compatible Editorial template without losing semantic content;
- a Brand System global color-token edit is reflected when the guide is reopened, proving live token projection;
- Custom guide generation can intentionally request a missing semantic page and surfaces `Needs input` in both the page rail and preview.

During browser-gate hardening, the Stage 05 tests exposed two real React event-state issues rather than test-only flakiness:

- Initial Project Form handlers read `event.currentTarget` from inside functional state updaters;
- the Custom guide-page checkbox did the same.

Both production handlers now snapshot `value` / `checked` inside the event handler before scheduling state updates. The browser suite then passed with normal Playwright checkbox interaction; no `force`, disabled assertion, or enlarged test timeout was used.

## Manual checks

- re-read the binding Stage 05 contract, Template Engine specification, and Template Schema from the Project Pack before completion;
- verified semantic PageContent remains independent from template family/variant data;
- verified global Brand System token values are resolved during query/render rather than copied into generated page content;
- verified template slot roles use an explicit allow-list and no arbitrary executable binding language was introduced;
- verified Custom missing-page behavior is intentional and visible rather than silently fabricating content;
- verified template switching preserves PageContent/extras/local overrides and Reset Layout has distinct semantics;
- reviewed the final PR tree for temporary `.stage05` transport/materializer files; none remain in the product diff;
- reviewed Stage 05 scope to ensure freeform canvas/layer manipulation, snapping, editor history, and command-stack behavior were not pulled forward from Stage 06.

## Known limitations / deliberate deferrals

- the 65-type semantic catalog is stable, but Stage 05 intentionally ships built-in layouts only for the initial representative page subset required by the Project Pack; additional page-type layout coverage can be added without changing PageContent contracts;
- template switching is content-safe now, but wrapping mutations in undoable editor commands belongs to the Stage 06 history/command system;
- Stage 05 is a generated/declarative preview surface; freeform selection, transforms, layers, guides, snapping, keyboard editing, and editor history belong to Stage 06;
- golden fixtures validate locale/template contracts and long-text stress data, not pixel-perfect screenshot approval across every browser/font rasterizer;
- bilingual mode requires both English and Arabic content locales to be enabled on the project;
- Vite still reports the initial `index` JavaScript chunk at about **665.73 kB minified / 204.23 kB gzip**, above the default 500 kB warning threshold. Guide Studio itself is lazy-emitted at about **11.30 kB minified / 3.46 kB gzip**. The shell debt is not hidden by raising `chunkSizeWarningLimit` and remains a performance item for profiling/Stage 10;
- Vercel production linkage remains an external deployment task and is not claimed complete here.

## Next-stage readiness

**Stage 06 may begin only after this completion record receives a final green PR-head CI run, PR #14 is squash-merged to `main`, merged `main` itself is green, and the verified Stage 05 merged-main handoff ZIP is produced.**

Stage 06 — Advanced Editor Core must start from that merged Stage 05 snapshot plus the binding Hawya Studio Project Pack.

Stage 06 may add editor command/history semantics around Stage 05 template operations, but it must preserve the Stage 05 invariant that semantic PageContent is independent from visual template/layout state.
