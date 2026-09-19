# IndexedDB Physical Schema

This is the initial Dexie mapping target; adjust indexes only with measured query needs and a DB migration.

```text
projects
  key: id
  indexes: name, updatedAt, lastOpenedAt
  value: lightweight ProjectMetadata + settings summary

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
