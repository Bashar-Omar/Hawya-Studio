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
