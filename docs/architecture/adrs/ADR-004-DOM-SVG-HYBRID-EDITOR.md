# ADR-004 — DOM/SVG hybrid retained-mode editor

**Status:** Accepted

## Decision
The editor stores a retained scene model and renders it with DOM/SVG primitives rather than using a bitmap canvas as the canonical surface.

- text layers render as HTML during editing so browser shaping/bidi/content editing remains robust;
- vector/shape layers use inline sanitized SVG or simple DOM/SVG primitives;
- image layers use browser image elements/canvas only for cropping/previews;
- transform controls are provided by an interaction adapter such as Moveable;
- exports render from the scene model, not by screenshotting the editor chrome.

## Why
Text fidelity, accessibility, direct SVG export, semantic selection, and Arabic editing are more important than supporting millions of particles or painting operations.

## Constraint
No `foreignObject`-dependent export promise. Editor may use HTML overlays, but SVG exporter owns explicit text serialization/path outlining logic.
