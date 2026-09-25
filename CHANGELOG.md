# Changelog

All notable changes to Hawya Studio are documented here.

The project follows Semantic Versioning. Pre-1.0 releases may evolve the editor UX and portable
project format, but schema changes remain explicitly versioned and migrated.

## [Unreleased]

No unreleased changes are recorded after `v0.1.0`.

## [0.1.0] - 2026-09-25

`v0.1.0` was published on 2026-09-25 from
`82da1460a31300be4e43385b8c6348a0b8201575` after merged-main CI, exact merged-SHA
Production verification, public tag verification, and source-handoff integrity checks.

### Added

- Local-first project creation, IndexedDB persistence, portable `.hawya` archive import/export, and
  schema migrations.
- Bilingual English/Arabic brand-system workflow with RTL-aware UI and direction-independent canvas
  coordinates.
- Brand assets, color and typography systems, guide templates, editor/history, smart audits,
  production exports, mockups, PWA/offline shell, storage diagnostics, and emergency backup recovery.
- Deterministic unit/integration/browser coverage, export semantic goldens, adversarial import
  fixtures, Chromium regression coverage, and Firefox/WebKit release-compatibility coverage.

### Changed

- Startup loading was split and budgeted so heavy editor/export/mockup modules do not regress into the
  initial application graph.
- Project schema moved from v1 to v2 to persist canonical mockup presets; v1 projects are migrated on
  import/open through the checked migration boundary.

### Fixed

- Failed durable writes now retain the newest canonical in-memory project snapshot and can export an
  emergency `.hawya` before retrying persistence.
- Mixed-direction Arabic/Latin editor content keeps physical page coordinates stable across interface
  direction changes.

### Security

- SVG imports are sanitized before reuse; malformed/unknown asset signatures and declared-type
  mismatches are rejected.
- `.hawya` archives enforce path, entry-count, compressed/uncompressed-size and checksum policies.
- Production CSP/security headers and emitted JavaScript dynamic-code checks are part of CI.
- Production dependency high/critical audit and license inventory are part of CI.

### Migration Notes

- Current canonical project schema: v2.
- Legacy v1 project snapshots are migrated to v2 without mutating the source fixture.
- IndexedDB physical schema and portable archive format versions are unchanged by the v1 -> v2
  project-model migration.
