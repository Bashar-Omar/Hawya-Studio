# Stage 06 Implementation Notes — Advanced Editor Core

Stage 06 introduces the retained-mode DOM/SVG editor described by ADR-004 without changing the canonical Brand System or semantic PageContent contracts established in Stages 04–05.

## Architecture split

```text
GuidePage + BrandSystem
  -> pure scene projection
  -> EditorSession application service
  -> React retained-mode canvas
  -> Moveable adapter for pointer transforms
```

- `resolveRenderedScene()` projects template-bound items and extra layers into a render-only scene model.
- template slot geometry/content edits use typed records inside the existing `GuidePage.localOverrides` envelope; semantic PageContent is not rewritten.
- extra layers continue to use canonical `GuidePage.extras`.
- `EditorSession` owns the transient-transform → one logical command → one repository save lifecycle.
- selection, marquee, zoom/pan, active tool, snap guides and Immer history are session-only state.
- Moveable events are normalized by an infrastructure adapter into canonical document-unit transforms before any application command sees them.
- the snap engine, alignment/distribution geometry and scene projection are framework-independent pure modules.

## Pointer and persistence lifecycle

A transform starts by copying canonical transforms into an in-memory transient map. Every drag/resize/rotate frame updates that map and React preview only. Pointer end commits the final geometry as one labeled Immer patch history entry and performs one repository save. Undo/redo applies inverse/forward patches and persists the resulting canonical page.

This is covered by a repository write-count test that sends 120 preview frames and verifies zero additional writes until commit. Commands that normalize to unchanged geometry also produce no history entry and no repository write.

## Coordinate and RTL rules

Document geometry is physical, not logical: `x = 0` is always the physical left page edge. UI chrome uses logical CSS and follows interface RTL, while page/layer/marquee/snap coordinates use physical `left/top` positioning. Switching the UI language therefore cannot mirror or mutate layer geometry.

Text layers render/edit through browser-native DOM text and textarea shaping with semantic `dir`/`lang`; no manual glyph reversal or Arabic reshaping is performed.

## History

Immer patches are enabled explicitly. One user command creates one labeled entry. History is session-only and bounded to 200 entries plus a 2 MiB estimated patch-memory budget. New commands clear redo history.

## Clipboard boundary

Internal copy/paste uses the `hawya.editor-clipboard.v1` payload. Clipboard JSON read from the browser is treated as untrusted input and runtime-validated with Zod against the canonical `layerSchema` before it can reach an editor command. Invalid or malformed clipboard data is ignored and the in-session fallback remains available.

## Simple groups

Stage 06 supports simple grouping with world-space appearance preserved across group/ungroup. Groups can be moved as a unit. Group resize/rotate is intentionally not enabled yet because nested transform composition does not have the golden coverage required by the Editor Engine contract. Distribution is likewise restricted to unrotated bounding boxes.

## Stage boundary

Stage 06 deliberately does not add Stage 07 smart-layout, AI, image extraction or advanced token engines. Export remains Stage 08.
