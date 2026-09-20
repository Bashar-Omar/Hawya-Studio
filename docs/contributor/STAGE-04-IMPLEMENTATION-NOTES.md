# Stage 04 Implementation Notes — Brand System and Asset Library

Stage 04 turns the Stage 03 canonical project into an actively editable Brand System without changing the local-first architecture or introducing a backend.

## Boundaries

- React consumes application use cases and queries from `StudioRuntime`; it does not import Dexie or parse untrusted files directly.
- Asset bytes stay content-addressed by SHA-256 in the existing binary store. Asset entities keep stable `AssetId` identity even when bytes are replaced.
- Logo variants, font references and text styles reference semantic IDs rather than copying files or token values.
- Color consumers resolve `colorTokenId` at render/use time so editing a global token propagates without mutating every consumer.
- Heavy Stage 04 code is behind the lazy Brand System route. Color.js, DOMPurify and the font parser are loaded only when the feature requires them.

## Asset ingestion pipeline

1. enforce local size policy;
2. sniff file bytes instead of trusting extension/MIME;
3. verify declared type compatibility;
4. sanitize SVG or analyze font/raster content through the relevant adapter;
5. write sanitized/original-safe bytes to the SHA-256 binary store;
6. persist an `Asset` entity and stable project ownership reference;
7. create a WebP raster preview derivative where supported.

SVG handling combines DOMPurify's SVG profile with Hawya's own deny rules for executable/embedded content, event handlers, inline style, external references and unsafe URLs. The sanitized SVG is reparsed and validated before persistence.

## Font handling

- Font parsing runs in a dedicated Worker and is terminated if it exceeds the safety time budget.
- Analysis records family/subfamily/PostScript metadata, variable axes, an Arabic glyph-coverage sample and GSUB/GPOS presence.
- Runtime rendering uses the browser `FontFace` API from local ArrayBuffer bytes and registers a Hawya-scoped family name.
- Font license/rights notes are user-supplied metadata; Hawya does not grant font rights.

## Color handling

- canonical screen input is six-digit sRGB HEX plus alpha;
- RGB, HSL and OKLCH are derived through Color.js;
- WCAG 2.1 contrast is calculated on demand;
- CMYK conversion is explicitly labelled suggested/generic;
- user-verified CMYK stays separate and is marked for review when the canonical screen color changes.

## Stage boundary

Stage 04 does not generate guide pages, implement the full editor, or pretend suggested print conversions are press-certified. Those remain later-stage responsibilities.
