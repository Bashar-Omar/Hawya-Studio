# Stage 04 Dependency Review

Stage 04 adds three browser-side dependencies, all loaded only by the Brand System feature or its workers.

## `dompurify` 3.4.15

Purpose: first-pass SVG sanitization before Hawya's stricter local-reference allow/deny checks.

- license: Apache-2.0 / MPL-2.0 dual licensing;
- actively maintained with recent security hardening;
- no backend or network service;
- dynamically imported only when SVG ingestion occurs;
- exit strategy: `AssetSanitizer` port isolates the dependency.

## `colorjs.io` 0.7.1

Purpose: standards-oriented color conversion and WCAG contrast math.

- license: MIT;
- zero runtime dependencies;
- dynamically imported when color editing/contrast is used;
- canonical data remains Hawya's own schema rather than Color.js objects;
- exit strategy: `ColorEngine` port isolates conversion/contrast behavior.

## `@cantoo/fontkit` 2.0.12

Purpose: font metadata, character-set and OpenType analysis inside a Web Worker.

The maintained Cantoo fork is selected instead of the older upstream `fontkit` package. At implementation time upstream had unresolved crafted-font denial-of-service reports and an older npm release. The fork is API-compatible, browser-oriented and actively maintained.

- license: MIT;
- loaded only inside `font.worker.ts`;
- worker is single-concurrency and terminated on timeout;
- worker output is converted into Hawya-owned plain data and validated at the application/domain boundary;
- no parser object crosses into persisted schema or UI state;
- exit strategy: `FontAnalyzer` port isolates the parser.

## Existing Fontsource packages

The automated Arabic-rendering gate reads an installed Noto Sans Arabic WOFF2 from the already-pinned `@fontsource-variable/noto-sans-arabic` dependency. No font binary is added to the Hawya repository or handoff archive.
