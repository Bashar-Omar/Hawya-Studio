# Bundled Asset Provenance Audit

Stage 12 treats every committed binary/demo asset as a redistribution decision.

## Current repository inventory

- `public/demo-assets/` contains no shipped demo asset; only `.gitkeep` is committed.
- Test fixtures are deterministic source/JSON fixtures and do not contain downloaded stock imagery,
  client logos, or third-party mockup photography.
- UI web-font binaries are emitted from the version-locked Fontsource packages at build time; their
  font licenses are documented in `FONT-LICENSES.md`.
- PWA icons are committed at `public/icons/hawya-192.png` and `public/icons/hawya-512.png`.

## Open provenance item

The repository and recovered project history available to Stage 12 do not contain a provenance note
for the two PWA icon PNGs. Before the public release tag, the maintainer must either:

- document that they are Hawya-owned/original generated assets; or
- replace them with newly generated project-owned icons and record that generation here.

No public release should infer provenance merely because an asset is already committed.
