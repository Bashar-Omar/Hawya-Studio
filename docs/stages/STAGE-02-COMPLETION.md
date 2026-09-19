# Stage 02 Completion Record — Domain, Persistence and Project Archive

Status: **complete — Stage 02 gate is green.**

## Binding scope completed

- canonical project schema version 1 with Zod runtime validation;
- Brand System, Guide Document, Asset, Template Ref, project metadata/settings, and revision domain types;
- injectable Clock, IdGenerator, ContentHasher, repository, binary-store, snapshot, and archive-codec ports;
- Dexie/IndexedDB persistence with normalized project, brand-system, page, asset, binary, snapshot, and preference storage boundaries;
- content-addressed binary storage keyed by SHA-256 with deduplication;
- reference-aware binary garbage collection after project deletion;
- autosave coordinator and save-state model;
- named, recovery, and autosave snapshot baseline with retention policy;
- .hawya ZIP archive codec using fflate;
- archive manifest, canonical JSON, checksums, version fields, import policy, and migration boundary;
- ZIP signature, path normalization, path traversal, duplicate-entry, entry-count, entry-size, archive-size, checksum, and binary-hash validation;
- import-as-new-project semantics so archive import never silently overwrites an existing local project;
- Stage 02 synthetic project fixture with shared image bytes and font bytes;
- full persist / reload / export / wipe / import round-trip integration test.

Stage 02 intentionally does **not** add the project-library UI or New Project wizard. Those are Stage 03 responsibilities.

## Architecture decisions changed

None.

ADR-001 through ADR-007 remain accepted. The implementation follows the existing local-first, zero-backend and canonical-project-source-of-truth decisions.

## Dependencies introduced

Runtime:

- dexie 4.4.6 — IndexedDB persistence adapter;
- fflate 0.8.3 — browser-safe ZIP encode/decode for .hawya archives;
- zod 4.6.5 — runtime schema validation and inferred TypeScript types.

Development/test:

- fake-indexeddb 6.2.5 — deterministic IndexedDB tests under Vitest.

No cloud database, Dexie Cloud, SaaS persistence, paid API, account system, runtime secret, or external storage service was introduced.

Dependency rationale and licensing are recorded in docs/contributor/STAGE-02-DEPENDENCY-REVIEW.md and docs/licenses/THIRD-PARTY-NOTICES.md.

## Gate evidence

Canonical PR: #8 — Stage 02: Domain, Persistence and Project Archive.

Final source CI run before this completion record: 35439909967.

### Quality gate — passed

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build

Results:

- Biome formatting verification passed;
- Biome lint passed with no reported errors;
- TypeScript 7 strict project build/typecheck passed;
- Vitest: **13 test files passed, 20 tests passed**;
- production Vite build passed.

### Required Stage 02 round-trip gate — passed

The synthetic Stage 02 integration fixture executes the binding Project Pack gate:

1. create a project containing asset metadata, duplicate binary references, and font bytes;
2. persist the project and content-addressed binaries to IndexedDB;
3. reload the structured project;
4. export a .hawya archive;
5. clear the test database;
6. import the archive as a new local project ID;
7. compare semantic project data;
8. verify SHA-256/checksum and binary-byte integrity.

The dedicated integration test src/infrastructure/db/stage02-roundtrip.test.ts passed inside the final quality run.

Additional Stage 02 tests cover schema validation, migrations, archive tampering/path safety, SHA-256 hashing, autosave retry/state, snapshot retention, shared-binary deletion safety, and project archive behavior.

### Chromium smoke — passed

    pnpm build
    pnpm test:browser

Result: **8 passed**.

The existing EN/AR application shell, RTL/LTR behavior, theme persistence, keyboard dialogs, responsive navigation, and no-horizontal-overflow browser checks remain green after introducing Stage 02 infrastructure.

## Persistence and archive guarantees established

- React/UI code does not talk to Dexie directly; persistence is behind application ports and infrastructure adapters.
- Project structured data and binary bytes are separate concerns.
- Binary identity is SHA-256 content-addressed, allowing deterministic deduplication.
- Project deletion does not remove a binary while another project or retained snapshot still references its hash.
- Archive import validates before committing project data.
- Imported archives receive a new local project ID.
- Schema migration is sequential and separated from storage schema versioning.
- .hawya is a documented ZIP container rather than an opaque proprietary blob.

## Security and corruption boundaries

The archive codec rejects or validates:

- invalid ZIP signatures;
- unsafe, absolute, traversal, or duplicate paths;
- excessive entry count, entry size, or total archive size;
- missing critical entries;
- unsupported archive/reader versions;
- invalid manifest/project schemas;
- missing or mismatched checksums;
- missing referenced binaries;
- invalid binary archive paths;
- binary bytes whose SHA-256 does not match their content hash.

## Repository hygiene

- the temporary .stage02 transport directory was removed after verified materialization;
- the temporary materializer workflow was removed;
- pnpm-lock.yaml was regenerated and committed deterministically;
- build output, node_modules, coverage, browser reports, database artifacts, environment files, and secrets are not committed.

## Known limitations / deliberate deferrals

- no project-library listing UI is wired to the repositories yet;
- no New Project wizard exists yet;
- no user-facing import/export buttons exist yet;
- no storage-persistence permission UX is exposed yet;
- no OPFS adapter is implemented; IndexedDB is the Stage 02 baseline;
- project archive processing is synchronous at this stage and can move behind the planned archive worker when large-file UX is introduced;
- editor/canvas, brand-entry UI, templates, mockups, and export renderers remain later-stage work.

## Next-stage readiness

**Stage 03 may begin.**

Stage 03 must start from the merged Stage 02 main snapshot plus the binding Hawya Studio Project Pack. It should build the recent-project library and resumable New Project wizard on these repository/use-case boundaries without bypassing them.

Stage 03 gate from the Project Pack: a user can complete a minimal project in both locales, close/reopen the browser, resume the wizard, finish, and reach an empty/generated guide shell.
