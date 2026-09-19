# System Architecture

## Architectural style

Hawya is a **modular local-first web application** using Clean Architecture principles without creating unnecessary service-layer ceremony.

```text
UI / React features
       ↓
Application use cases + command bus
       ↓
Domain model + policies + schemas
       ↓ ports
Infrastructure adapters
  ├ IndexedDB/Dexie
  ├ ZIP archive
  ├ browser file APIs
  ├ workers
  ├ SVG sanitizer
  ├ export renderers
  └ optional PWA/runtime adapters
```

Dependencies point inward. Domain code does not import React, Dexie, Moveable, Tailwind, browser globals, or Vercel.

## Major bounded modules

### Project
Metadata, lifecycle, snapshots, project archive, migration.

### Brand
Identity, localized content, logos, colors, typography, visual language, semantic tokens.

### Assets
Binary metadata, content hashes, references, previews, derivatives, sanitization status.

### Guide
Sections, semantic pages, page content, template binding, page ordering.

### Editor
Selection, viewport, transient transforms, commands, history, snapping, layer manipulation.

### Templates
Page-type contracts, template variants, slot bindings, layout defaults and template packs.

### Analysis
Logo geometry, color extraction/conversion, contrast, font metadata/coverage, audits.

### Export
Preflight and format-specific renderers.

## Runtime topology

There is only one mandatory runtime: the user's browser.

```text
GitHub source → CI → static bundle → Vercel CDN
                                  ↓
                              Browser
                               ├ IndexedDB
                               ├ Cache/Service Worker
                               ├ Web Workers
                               └ user file downloads
```

No production API endpoint is required for core operation.

## Source of truth

A canonical BrandSystem object plus Guide semantic content. UI stores are caches/session projections, not the authoritative persisted format.

## Ports

Examples:

```ts
interface ProjectRepository { ... }
interface BinaryStore { ... }
interface ProjectArchiveCodec { ... }
interface SvgSanitizer { ... }
interface FontAnalyzer { ... }
interface RasterAnalyzer { ... }
interface ExportRenderer { ... }
interface Clock { now(): string }
interface IdGenerator { newId(): string }
```

Infrastructure implementations can change without rewriting domain/use cases.

## Architecture rule for future cloud sync

If cloud sync is ever added, it implements repository/sync ports. Domain objects must not be redesigned around remote database records now. Local-first IDs, revisions and migrations are already stable enough to sync later.
