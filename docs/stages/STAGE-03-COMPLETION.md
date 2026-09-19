# Stage 03 Completion Record — Project Library and Setup Wizard

Status: **complete — Stage 03 functional gate is green.**

## Binding scope completed

- recent-project library queries project ID + metadata only and does not hydrate Brand System, guide pages, assets, or binary bytes;
- create, rename, duplicate, delete, import, and backup/export project actions are implemented through application use cases;
- duplicate creates a new project ID, rebases project/asset ownership, and reuses content-addressed binary hashes without duplicating binary bytes;
- delete reuses Stage 02 reference-safe binary garbage collection and also removes setup workflow state;
- import reuses the validated Stage 02 .hawya importer and therefore imports as a new local project ID;
- backup/export reuses the Stage 02 archive writer and downloads a portable .hawya file through a browser-native Blob download;
- storage diagnostics expose browser persistence status, quota/usage estimates, and a request-persistent-storage action as progressive enhancement;
- resumable New Project workflow covers Basic → Logo → Colors → Typography → Foundation → Guide;
- the canonical Project Schema v1 project is created at the Basic step and remains valid throughout setup;
- setup workflow progress is persisted separately behind SetupDraftRepository in namespaced IndexedDB preferences;
- every wizard transition persists its draft state;
- skipped steps are recorded explicitly and never synthesize logo, color, font, foundation, or guide content;
- English and Arabic setup flows preserve UI direction independently from canonical document data;
- completion removes temporary setup workflow metadata and opens an honest empty guide shell.

## Architecture decisions changed

None.

ADR-001 through ADR-007 remain accepted and unchanged. Stage 03 adds workflow/application behavior on top of Stage 02 boundaries without changing Project Schema version 1 or the IndexedDB database version.

React continues to consume application/runtime boundaries rather than importing Dexie directly.

## Dependencies introduced

**None.**

Stage 03 uses the already pinned Stage 01 UI foundation and Stage 02 Dexie/Zod/fflate persistence stack. No new npm package, SaaS SDK, backend, account system, paid API, cloud database, or runtime secret was introduced.

## Browser file and storage strategy

- .hawya import uses a normal file input so the workflow does not depend on the non-universal File System Access picker API;
- export uses a Blob-backed download with a sanitized project-derived filename;
- StorageManager estimate/persisted/persist support is progressive enhancement; IndexedDB remains functional when those optional APIs are unavailable;
- persistent-storage permission is not represented as a substitute for explicit portable backups.

## Gate evidence

Canonical PR: #10 — Stage 03: Project Library and Setup Wizard.

Final functional CI run before this completion record: `35442202302`.

### Quality gate — passed

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build

Results:

- Biome formatting verification passed;
- Biome lint passed with no reported errors;
- TypeScript 7 strict project build/typecheck passed;
- Vitest: **14 test files passed, 24 tests passed**;
- production Vite build passed.

Stage 03 unit/integration coverage includes:

- metadata-first project listing and recent ordering;
- resumable setup-draft persistence;
- canonical project creation and finish behavior;
- explicit skipped/missing setup states;
- rename / duplicate / delete repository boundaries;
- Stage 02 persistence/archive tests remain green.

### Chromium gate — passed

    pnpm build
    pnpm test:browser

Result: **11 passed**.

The browser suite verifies:

- the existing Stage 01 EN/AR shell, RTL/LTR behavior, theme persistence, dialogs, responsive navigation, and horizontal-overflow checks remain green;
- an English minimal project can start setup, close the page, reopen the browser page, resume at the persisted step, reload again, finish, and reach the empty guide shell;
- an Arabic minimal project completes while `html[dir=rtl]` remains intact;
- Project Library can rename a project, export/download a .hawya backup, duplicate it, delete a project, import the downloaded .hawya file, and return to a consistent library.

## Accessibility / UI corrections made during the gate

- removed implicit autofocus from the first wizard field;
- replaced unsupported aria-label grouping with semantic section/heading and fieldset/legend structures;
- corrected CSS specificity ordering instead of suppressing Biome rules;
- kept wizard draft props explicit under TypeScript exactOptionalPropertyTypes;
- tightened the Playwright Backup locator to its exact accessible name instead of changing production UI to satisfy a test.

## Repository / data-boundary guarantees

- ProjectRepository.listMetadata() is the library listing boundary and returns only project ID + metadata;
- setup progress remains workflow state outside the canonical Brand System;
- duplicate does not clone content-addressed binary bytes;
- no direct IndexedDB/Dexie calls were introduced into React components;
- no Project Schema v1 migration was required for the setup workflow.

## Known limitations / deliberate deferrals

- Logo upload/sanitization and font upload/analysis are intentionally unavailable in Stage 03; those belong to Stage 04, so these steps currently support an explicit missing/skipped state rather than fake data;
- template-driven guide generation belongs to Stage 05; Stage 03 finishes at an honest empty guide shell;
- portable .hawya archives contain canonical project data, not transient setup-workflow progress; importing an unfinished project preserves canonical project data but not the local wizard checkpoint;
- Vite reports the current main JavaScript chunk at about 611 kB minified and emits its 500 kB code-splitting warning. This is non-blocking for Stage 03 but should be addressed before the performance-focused Stage 10 gate, and earlier where feature-boundary lazy loading is practical;
- Vercel production project/linkage remains an external deployment task and is not claimed complete here.

## Next-stage readiness

**Stage 04 may begin.**

Stage 04 — Brand System and Asset Library must start from the merged Stage 03 main snapshot plus the binding Hawya Studio Project Pack.

The Stage 04 gate requires global token propagation, reference-preserving asset replacement, malicious SVG sanitization/rejection, and rendering of an uploaded Arabic font in the editor sample.
