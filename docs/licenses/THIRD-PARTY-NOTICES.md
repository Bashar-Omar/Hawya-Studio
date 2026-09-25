# Third-party notices — Hawya Studio

Hawya Studio source code is MIT licensed. Third-party packages retain their own licenses. The table
below records the direct production dependencies pinned by `package.json` for the Stage 12 `v0.1.0`
release candidate.

| Package | Version | License |
| --- | ---: | --- |
| `@base-ui/react` | 1.8.0 | MIT |
| `@fontsource-variable/inter` | 5.3.0 | OFL-1.1 (font content) |
| `@fontsource-variable/noto-sans-arabic` | 5.3.0 | OFL-1.1 (font content) |
| `lucide-react` | 1.47.0 | ISC |
| `react` | 19.3.0 | MIT |
| `react-dom` | 19.3.0 | MIT |
| `dexie` | 4.4.6 | Apache-2.0 |
| `fflate` | 0.8.3 | MIT |
| `zod` | 4.6.5 | MIT |
| `@cantoo/fontkit` | 2.0.12 | MIT |
| `colorjs.io` | 0.7.1 | MIT |
| `dompurify` | 3.4.15 | MPL-2.0 OR Apache-2.0 |
| `immer` | 11.1.18 | MIT |
| `react-moveable` | 0.56.0 | MIT |

The lockfile pins the complete resolved dependency graph. CI runs `pnpm inventory:licenses` for the
production dependency tree and uploads the resulting inventory as a release-audit artifact; this file
is the human-readable direct-dependency notice and does not replace individual package license text.

## Bundled UI fonts

Inter Variable and Noto Sans Arabic Variable are self-hosted through the pinned Fontsource packages.
See `FONT-LICENSES.md` for the font-specific record and OFL references.

## Local-first dependency boundaries

Dexie is used only for browser-local IndexedDB persistence; Hawya does not depend on Dexie Cloud.
No direct production dependency is a required hosted API or paid SaaS dependency for core usage.

## Asset redistribution

See `ASSET-PROVENANCE.md`. Hawya does not ship downloaded stock photography, third-party product
logos, or random web mockups as demo assets. User-uploaded client assets remain the user's licensing
responsibility and are not published by Hawya.
