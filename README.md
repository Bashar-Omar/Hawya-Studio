# Hawya Studio — ستديو هوية

**Encode the brand once. Publish it everywhere.**

Hawya Studio is a free, open-source, local-first Brand System Production Studio for brand designers. It is designed to turn structured identity inputs into reusable brand systems, editable guidelines, assets, and honest export formats without requiring an account, paid API, cloud database, or subscription.

> Current status: **v0.1.0 released**. Stage 12 is formally closed. The public release is tagged at `82da1460a31300be4e43385b8c6348a0b8201575`, and the production app is available at [hawya-studio.vercel.app](https://hawya-studio.vercel.app).

## Non-negotiable guarantees

- Free core product and public source code.
- Local-first: projects and user assets are intended to stay on the device unless the user explicitly exports or shares them.
- No required backend, account, API key, or paid service.
- Arabic and English are first-class; UI direction and canvas/content direction are separate concerns.
- The canonical Brand System is the source of truth; documents are projections of it.
- Exports are labeled honestly. Hawya will not pretend a browser-generated file is a native `.ai`, `.indd`, or `.psd` document.

## Toolchain

- Node.js 24 LTS
- pnpm 12
- Vite 8.1 + React 19.3
- TypeScript 7 strict
- Tailwind CSS 4.3
- shadcn/ui configuration prepared for first-class RTL
- Biome for deterministic linting/formatting
- Vitest + Playwright

The TypeScript 7 baseline is intentionally paired with Biome because the current `typescript-eslint` line does not support TypeScript 7. See [`docs/contributor/TOOLCHAIN-NOTES.md`](docs/contributor/TOOLCHAIN-NOTES.md).

## Requirements

- Node.js `24.x`
- pnpm `12.4.2`

With Corepack:

```bash
corepack enable
corepack prepare pnpm@12.4.2 --activate
```

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Quality gate:

```bash
pnpm check
pnpm build
pnpm check:performance
pnpm check:security-policy
pnpm check:release-docs
pnpm test:browser
```

`pnpm check` runs formatting verification, linting, strict type-checking, and unit tests.

Stage completion evidence: [`Stage 01`](docs/stages/STAGE-01-COMPLETION.md) · [`Stage 02`](docs/stages/STAGE-02-COMPLETION.md) · [`Stage 03`](docs/stages/STAGE-03-COMPLETION.md) · [`Stage 04`](docs/stages/STAGE-04-COMPLETION.md) · [`Stage 05`](docs/stages/STAGE-05-COMPLETION.md) · [`Stage 06`](docs/stages/STAGE-06-COMPLETION.md) · [`Stage 07`](docs/stages/STAGE-07-COMPLETION.md) · [`Stage 08`](docs/stages/STAGE-08-COMPLETION.md) · [`Stage 09`](docs/stages/STAGE-09-COMPLETION.md) · [`Stage 10`](docs/stages/STAGE-10-COMPLETION.md) · [`Stage 11`](docs/stages/STAGE-11-COMPLETION.md) · [`Stage 12`](docs/stages/STAGE-12-COMPLETION.md).

## Architecture reading order

Before implementing product behavior, read:

1. [`docs/architecture/SYSTEM-ARCHITECTURE.md`](docs/architecture/SYSTEM-ARCHITECTURE.md)
2. [`docs/architecture/MODULE-BOUNDARIES.md`](docs/architecture/MODULE-BOUNDARIES.md)
3. [`docs/architecture/adrs/`](docs/architecture/adrs/)
4. [`docs/project-format/`](docs/project-format/)
5. [`docs/contributor/CODING-STANDARDS.md`](docs/contributor/CODING-STANDARDS.md)
6. [`docs/contributor/DEPENDENCY-POLICY.md`](docs/contributor/DEPENDENCY-POLICY.md)
7. [`docs/contributor/QUALITY-GATES.md`](docs/contributor/QUALITY-GATES.md)

## Repository architecture

Hawya follows a pragmatic Clean Architecture split:

```text
UI → application/use-cases → domain ← ports ← infrastructure/adapters
```

The domain layer must remain framework- and browser-independent. React renders UI; it is not the business logic layer. Persistent storage and file/export implementations stay behind application ports.

## Deployment

The web app builds to static assets and requires no runtime secret. Vercel is the primary public deployment target. Release deployments are intentional and tied to exact commits; automatic per-commit Vercel deployment remains disabled so production provenance stays explicit.

```bash
pnpm install --frozen-lockfile
pnpm build
```

The output is `dist/`. Vercel uses Vite, Node 24.x, `pnpm build`, and no required environment variables or server functions. See [`docs/release/DEPLOYMENT.md`](docs/release/DEPLOYMENT.md) for direct-route/PWA checks and the static-host fallback status.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). All changes must preserve the zero-cost, local-first core unless an accepted ADR explicitly changes that contract.

## Security

File import, SVG handling, archives, browser persistence, and later service-worker behavior are security-sensitive. See [`SECURITY.md`](SECURITY.md) before changing those surfaces.

## License

MIT — see [`LICENSE`](LICENSE). Direct production dependency notices are in [`docs/licenses/THIRD-PARTY-NOTICES.md`](docs/licenses/THIRD-PARTY-NOTICES.md), with bundled asset provenance tracked in [`docs/licenses/ASSET-PROVENANCE.md`](docs/licenses/ASSET-PROVENANCE.md).

Release evidence is tracked in [`docs/release/RELEASE-CHECKLIST.md`](docs/release/RELEASE-CHECKLIST.md), [`docs/stages/STAGE-12-COMPLETION.md`](docs/stages/STAGE-12-COMPLETION.md), and [`CHANGELOG.md`](CHANGELOG.md). The published source handoff is attached to the [v0.1.0 GitHub Release](https://github.com/Bashar-Omar/Hawya-Studio/releases/tag/v0.1.0).
