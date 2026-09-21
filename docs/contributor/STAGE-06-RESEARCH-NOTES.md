# Stage 06 Research Notes — Advanced Editor Core

Research date: 2026-09-20.

## Moveable integration

Current Moveable documentation still exposes drag, resize and rotate lifecycle events and supports DOM/SVG targets. Hawya treats these events as an interaction adapter only. Drag distances are converted from screen pixels back into document units using current zoom and page-unit scale. Canonical geometry is normalized before command commit.

The editor deliberately does not persist Moveable `transform` strings or use the DOM as source of truth.

## Immer history

Current Immer documentation requires explicit `enablePatches()` and exposes `produceWithPatches` plus `applyPatches` for undo/redo. Hawya records one history entry per meaningful command rather than per pointer frame, and keeps this stack session-only.

## Browser-native bidi/text editing

Stage 06 preserves ADR-004: text is edited as HTML/DOM content so the browser owns Unicode bidi and Arabic shaping. Hawya stores semantic text, language and direction; it never reverses Arabic strings manually.

## Performance stance

Transient drag/resize/rotate previews remain in memory at interaction frequency. Repository persistence happens only on transform end. Snap/alignment services are pure geometry code, which keeps pointer-frame work independent from IndexedDB and makes the hot path directly unit-testable.
