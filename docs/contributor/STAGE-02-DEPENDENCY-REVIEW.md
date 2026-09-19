# Stage 02 Dependency Review

Stage 02 adds only packages required by the accepted persistence/archive architecture. No package requires an account, API key, backend, subscription or hosted runtime.

## `dexie@4.4.6` — runtime

- **Problem:** typed IndexedDB tables, transactions and versioned browser-database schema.
- **Why native IndexedDB alone is insufficient:** native IndexedDB is intentionally low-level; hand-writing transaction/request orchestration would add boilerplate and make migration/repository code harder to audit.
- **License:** Apache-2.0, compatible with Hawya's MIT application distribution.
- **Maintenance:** active Dexie 4 line; 4.4.6 is the current reviewed release for this stage.
- **Bundle strategy:** imported only by persistence infrastructure; no Dexie Cloud package is installed.
- **Exit strategy:** all database access is behind application ports, so a future native IndexedDB/OPFS adapter can replace Dexie without changing domain objects.

## `zod@4.6.5` — runtime

- **Problem:** authoritative runtime validation for external boundaries and migrated persisted data.
- **Why TypeScript alone is insufficient:** TypeScript types disappear at runtime and cannot validate archive JSON or corrupted IndexedDB records.
- **License:** MIT.
- **Maintenance:** Zod 4 is stable and active; 4.6.5 is the reviewed release.
- **Bundle strategy:** schemas are normal tree-shakeable ESM imports; no remote service.
- **Exit strategy:** schemas live beside domain types and are not exposed as storage-engine contracts.

## `fflate@0.8.3` — runtime

- **Problem:** browser-compatible ZIP creation/extraction for the open `.hawya` format.
- **Why native platform APIs are insufficient:** browser Compression Streams do not provide a portable ZIP container API with the entry metadata/filtering Hawya needs.
- **License:** MIT.
- **Maintenance/security posture:** 0.8.3 includes 2026 ZIP64/buffer-over-read fixes and TypeScript typing fixes.
- **Bundle strategy:** archive code is isolated under `infrastructure/archive`; it can be lazy-loaded when archive UI arrives.
- **Exit strategy:** `ProjectArchiveCodec` hides fflate from domain/application code.

## `fake-indexeddb@6.2.5` — development only

- **Problem:** deterministic IndexedDB repository tests under Vitest/Node without a browser or network.
- **License:** Apache-2.0.
- **Runtime impact:** none; dev dependency only.
- **Testing role:** repository/archive gate still uses the same Dexie adapter and browser IndexedDB API shape; real-browser persistence journeys can be added as UI workflows become available.
- **Exit strategy:** tests can switch to a different IndexedDB test adapter without production code changes.
