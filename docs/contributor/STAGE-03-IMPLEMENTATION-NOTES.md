# Stage 03 Implementation Notes — Project Library and Setup Wizard

Stage 03 builds the project-library and resumable setup workflow on the accepted Stage 02 local-persistence boundaries. It does not change any accepted ADR.

## Architecture

- React consumes a `StudioRuntime` composition root and application use cases; UI components do not import Dexie or issue IndexedDB requests directly.
- `ProjectRepository.listMetadata()` returns only the project ID plus `ProjectMetadata`. Library listing never hydrates the Brand System, guide pages, assets or binaries.
- Recent-project ordering is derived from metadata only, preferring `lastOpenedAt` and falling back to `updatedAt`.
- The canonical project is created and persisted at the Basic step. It stays valid against Project Schema v1 throughout setup.
- Wizard progress is workflow state, not Brand System data. It is stored behind `SetupDraftRepository` in the existing IndexedDB `preferences` table under namespaced keys, so no database-version or Project Schema version change is required.
- Every step transition persists the setup draft. Completed and skipped states are explicit. Skipping never invents logo, color, font, foundation or guide content.

## Stage boundaries

The Logo and Typography setup steps deliberately expose honest missing-data states in Stage 03. Upload, sanitization, font analysis, FontFace registration and asset-library behavior are Stage 04 responsibilities in the binding Project Pack.

The Guide step stores the requested guide profile and completes setup, but it leaves an honest empty guide shell. Template-driven guide generation is Stage 05 scope.

## Project actions

- **Create:** persists a minimal canonical project plus resumable setup metadata.
- **Rename:** updates project metadata and slug through the repository boundary.
- **Duplicate:** creates a new project ID and rebases project/asset ownership while retaining content-addressed binary hashes; binary bytes are not duplicated. In-progress setup state is copied when present.
- **Delete:** uses the existing Stage 02 reference-safe delete/garbage-collection flow, then removes setup workflow state.
- **Import:** reuses the validated Stage 02 `.hawya` importer and therefore imports under a new local project ID.
- **Backup/export:** reuses the Stage 02 archive writer and records backup/export timestamps only after archive creation succeeds.

## Browser file and storage strategy

`.hawya` import uses a normal file input and export uses a Blob-backed browser download. The File System Access API is intentionally not a mandatory dependency because `showOpenFilePicker()` is not Baseline across major browsers.

Storage messaging uses `navigator.storage.estimate()`, `persisted()` and `persist()` when available. These APIs are progressive enhancement only; unsupported browsers continue to use IndexedDB and receive explicit best-effort storage messaging.

## Dependencies

Stage 03 introduces **no new npm dependencies**. It uses the Stage 01 UI foundation and Stage 02 Dexie/Zod/fflate persistence stack already pinned in `pnpm-lock.yaml`.
