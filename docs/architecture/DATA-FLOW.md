# Data Flow

## Startup

1. load static application shell;
2. initialize database schema/migrations;
3. load preferences;
4. request/inspect storage persistence status non-blockingly;
5. list project metadata only, not full project blobs;
6. opening a project hydrates brand/pages/asset metadata on demand.

## Mutation

```text
User gesture
→ UI validates interaction-level input
→ application command
→ domain validation/invariants
→ immutable update + Immer patches
→ session projection updates immediately
→ enqueue persistence transaction
→ autosave indicator
→ persist successful / failure recovery
```

## Continuous transforms

Drag frames remain transient. Only pointer-up commits the final geometry. This prevents thousands of history records and database writes.

## Token reference update

A layer referencing `colorTokenId` does not receive a copied color. Renderer resolves token through selectors. Changing the token repaints all references without rewriting every page record.

## Asset import

```text
File
→ basic type/size sniff
→ ArrayBuffer/Blob
→ SHA-256
→ if duplicate binary exists, reuse
→ type-specific worker analysis
→ SVG sanitization where applicable
→ thumbnail/preview derivative
→ metadata record
→ project asset reference
```

## Export

Exporters consume an immutable project snapshot. Editing may continue only if renderer is designed to snapshot state first; output must not contain half-applied live changes.
