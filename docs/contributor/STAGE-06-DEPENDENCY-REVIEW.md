# Stage 06 Dependency Review — Advanced Editor Core

Research date: 2026-09-20.

Stage 06 introduces two runtime dependencies because the binding Project Pack explicitly requires a Moveable transform adapter and Immer patch-based command history.

## `react-moveable@0.56.0`

- purpose: React adapter for draggable/resizable/rotatable DOM/SVG targets;
- current npm release reviewed: `0.56.0`;
- license: MIT;
- TypeScript declarations: included;
- architecture placement: imported only by `features/editor/EditorCanvas.tsx`; raw Moveable events are normalized by `infrastructure/editor/moveable-transform-adapter.ts` before canonical document geometry is committed;
- canonical-state rule: CSS transform strings from Moveable are never stored in project JSON; document-unit `LayerTransform` values remain canonical;
- persistence rule: pointer-frame events update transient session state only; persistence occurs once when the interaction ends;
- rollback/exit: the adapter surface is deliberately small (`drag`, `resize`, `rotate` conversions), so another interaction library can replace Moveable without changing the GuidePage schema or command/history engine.

References reviewed:

- https://www.npmjs.com/package/react-moveable
- https://daybrush.com/moveable/release/latest/doc/

## `immer@11.1.18`

- purpose: command transaction patches/inverse patches for bounded session undo/redo;
- current npm release reviewed: `11.1.18`;
- license: MIT;
- direct dependencies: none according to current npm metadata;
- patch plugin: enabled once through `enablePatches()` before using `produceWithPatches` / `applyPatches`;
- persistence rule: history entries are session memory only and are never serialized into `.hawya` project archives;
- memory rule: editor history is bounded by both count (200 meaningful entries) and an initial two-megabyte estimated patch budget;
- rollback/exit: history API is isolated in `editor/history/editor-history.ts`, so patch implementation can be replaced without touching editor UI or canonical project schema.

References reviewed:

- https://www.npmjs.com/package/immer
- https://immerjs.github.io/immer/patches/

## Decision

Both dependencies satisfy the Project Pack's explicit Stage 06 architecture. No new state-management framework, backend, account service, paid API, runtime secret, or cloud dependency is introduced.
