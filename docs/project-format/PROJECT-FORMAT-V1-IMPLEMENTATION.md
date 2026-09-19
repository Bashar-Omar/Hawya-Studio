# Hawya Project Format v1 — Implementation Notes

This document records the concrete Stage 02 implementation of the accepted project-format architecture. It does not replace the canonical Project Pack documents.

## Canonical aggregate

Persistence and archive boundaries validate a `ProjectSnapshot` containing:

- canonical `HawyaProject` schema version 1;
- project-local `Asset` metadata entities;
- no Blob URLs, browser handles, React state or editor viewport state.

Structured IndexedDB storage is normalized across project, brand, page and asset tables. Repositories reassemble and revalidate the canonical aggregate on read.

## Binary storage

Binary bytes are content-addressed with lowercase SHA-256. IndexedDB stores one Blob per content hash. Multiple assets/projects may reference the same content hash without duplicating bytes.

## `.hawya` archive

The Stage 02 writer emits:

```text
manifest.json
project.json
checksums.json
assets/<sha256>.<ext>
fonts/<sha256>.<ext>
README.txt
```

`project.json` contains the canonical `ProjectSnapshot`. `checksums.json` covers `project.json` and every included binary entry. The importer validates ZIP signature, path safety, duplicate paths, entry/count/size policy, manifest compatibility, checksums, schema migration/validation and binary filename/content hashes before persistence.

## Import identity

Archive import never reuses the source local project ID by default. Application import rebases the project and asset `projectId` values to a newly generated local UUID after the archive has been fully validated in memory.

## Snapshot baseline

Named snapshots are retained until explicitly removed. Recovery and autosave checkpoints use independent bounded rolling retention policies. Snapshot records reference binary hashes and never duplicate binary bytes.

## Current deliberate limits

- schema version 1 has no predecessor migration yet; the migration runner is present and rejects unsupported future/unknown versions explicitly;
- asset type-specific parsing/sanitization belongs to Stage 04;
- project-library actions and user-facing import/export controls belong to Stage 03/08 respectively;
- large archive work is isolated behind `ProjectArchiveCodec` so it can move to a dedicated worker without domain changes.
