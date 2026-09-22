# Schema Migrations and Project Versioning

## Two version systems

Do not confuse:

1. `schemaVersion` — internal data format compatibility.
2. user brand revision — named design/version snapshots such as `v1.0`, `Client Final`, `Before Rebrand`.

## Schema migration

```ts
type Migration = {
 from: number;
 to: number;
 migrate(input: unknown): unknown;
};
```

Rules:
- migrations are one-way and sequential;
- every migration has fixtures from prior versions;
- migration never mutates source object;
- migration output is immediately validated with target Zod schema;
- failed migration leaves local/imported source intact;
- archive importer reports exact unsupported version.

## Local history

### Session undo/redo
Fine-grained command history, not persisted forever.

### Autosave checkpoints
A bounded rolling set, e.g. last 10–20 meaningful checkpoints subject to project size policy.

### Named snapshots
User-controlled, retained until user removes them.

Snapshot stores structured state diff/full compressed JSON depending implementation benchmarks; binaries are referenced by content hash rather than copied each time.


## Current migration history

### v1 → v2 — Stage 09

Stage 09 introduces canonical reusable mockup/application presets.

The sequential migration:

- preserves the source object by migrating a structured clone;
- changes `project.schemaVersion` from `1` to `2`;
- adds `project.mockups = { presets: [] }`;
- does not invent or infer presets from existing image assets;
- validates the complete migrated `ProjectSnapshot` with the v2 Zod schema before it can be persisted or imported.

The physical IndexedDB schema/index version does **not** change for this migration because `mockups` is stored as an unindexed field on the existing project row. Existing v1 rows migrate in memory when read and become v2 on the next normal save. Archive import uses the same migration runner before persistence.
