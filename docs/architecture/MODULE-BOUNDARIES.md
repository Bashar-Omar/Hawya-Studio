# Module Boundaries and Allowed Dependencies

## Allowed direction

```text
app/routes → features → application → domain
                         ↓
                  infrastructure adapters implement ports
```

A feature may depend on shared UI primitives and application/domain APIs. It may not reach into another feature's internal store.

## Forbidden examples

- `domain/color.ts` importing `zustand`;
- React component writing directly to Dexie table;
- Moveable event handler mutating a page object in place;
- export renderer reading DOM as its canonical data when a scene model renderer exists;
- templates importing editor Zustand state;
- asset worker calling toast UI;
- `window.localStorage` scattered throughout components.

## Integration points

Features communicate through application commands/queries or typed events:
- `UpdateColorTokenCommand`
- `AddAssetCommand`
- `ApplyPageTemplateCommand`
- `TransformLayersCommand`
- `ExportProjectUseCase`

## Shared code criteria

Code enters `shared/` only if it is domain-neutral and used by at least two bounded modules. Never create `utils.ts` dumping grounds.

## UI ownership

`components/ui` = copied/adapted shadcn primitives.  
`components/app` = cross-feature application chrome.  
`features/*/components` = feature-specific UI.
