# Bundled Asset Provenance Audit

Stage 12 treats every committed binary/demo asset as a redistribution decision.

## Current repository inventory

- `public/demo-assets/` contains no shipped demo asset; only `.gitkeep` is committed.
- Test fixtures are deterministic source/JSON fixtures and do not contain downloaded stock imagery,
  client logos, or third-party mockup photography.
- UI web-font binaries are emitted from the version-locked Fontsource packages at build time; their
  font licenses are documented in `FONT-LICENSES.md`.
- PWA icons at `public/icons/hawya-192.png` and `public/icons/hawya-512.png` are Hawya-owned generated
  assets. Their source is `scripts/generate-app-icons.mjs`; the generator uses only Node.js core APIs
  and deterministically renders Hawya's simple H mark into valid RGB PNGs.

## Reproducible app icons

Run:

```bash
pnpm generate:app-icons
pnpm check:app-icons
```

The validation gate parses every PNG chunk, checks CRCs and declared dimensions, inflates the IDAT
stream, and verifies the decoded scanline size. This catches truncated/corrupt images rather than
trusting only the PNG signature or IHDR metadata.

Stage 12 replaced the previous 512px icon after release audit proved that its PNG container advertised
the expected dimensions but the compressed image stream could not be decoded completely. The new
192px and 512px files are regenerated from the checked-in source so provenance does not depend on
historical chat context or an unverifiable binary origin.
