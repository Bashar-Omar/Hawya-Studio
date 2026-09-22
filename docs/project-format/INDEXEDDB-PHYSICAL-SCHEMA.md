# IndexedDB Physical Schema

This is the initial Dexie mapping target; adjust indexes only with measured query needs and a DB migration.

```text
projects
  key: id
  indexes: name, updatedAt, lastOpenedAt
  value: ProjectMetadata + settings + guide ordering/sections + refs/revisions + unindexed mockup collection

brandSystems
  key: projectId
  value: validated BrandSystem

pages
  compound key: [projectId+id]
  indexes: projectId, [projectId+order]
  value: GuidePage

projectAssets
  compound key: [projectId+id]
  indexes: projectId, contentHash, kind
  value: Asset metadata (no large binary)

binaries
  key: contentHash
  value: Blob + byteLength + mime + ref bookkeeping/cache metadata

snapshots
  compound key: [projectId+createdAt]
  indexes: projectId, named
  value: structured snapshot or compressed payload referencing binary hashes

preferences
  key: key
  value: small app preference record
```

## Transactions
Project save affecting brand/pages/assets metadata runs one Dexie transaction across impacted tables where IndexedDB permits. Binaries are written before references become durable or within transaction strategy so no project points to missing bytes.

## Delete
Project deletion is two-phase from user perspective: remove project records then garbage-collect unreferenced binaries after reference scan. Never delete shared hash binary before scan.


## Stage 09 schema-v2 persistence note

Reusable mockup presets are canonical project data but do not require new query indexes. Stage 09 therefore adds the validated `mockups` collection to the existing project row without changing the Dexie database/index version.

Repository save writes `project.mockups` in the same project transaction as other structured project fields. Repository read reassembles the aggregate and runs the normal sequential project migration/validation pipeline, so persisted v1 rows receive an empty v2 mockup collection before use.

Mockup background/artwork binaries remain ordinary content-addressed asset binaries; presets store only stable asset/page references and normalized geometry, never Blob URLs or browser object handles.
