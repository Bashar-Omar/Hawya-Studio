# Contributing to Hawya Studio

Thank you for helping build Hawya Studio. The project is intentionally free, local-first, bilingual, and source-owned. Contributions must preserve those contracts.

## Prerequisites

- Node.js 24 LTS
- pnpm 12.4.2
- Git

Enable the repository-pinned package manager:

```bash
corepack enable
corepack prepare pnpm@12.4.2 --activate
```

## Setup

```bash
git clone https://github.com/Bashar-Omar/Hawya-Studio.git
cd Hawya-Studio
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

For the Chromium smoke test:

```bash
pnpm exec playwright install chromium
pnpm test:browser
```

## Required reading before architecture changes

1. `docs/architecture/SYSTEM-ARCHITECTURE.md`
2. `docs/architecture/MODULE-BOUNDARIES.md`
3. every accepted ADR in `docs/architecture/adrs/`
4. relevant documents in `docs/project-format/`
5. `docs/contributor/CODING-STANDARDS.md`
6. `docs/contributor/DEPENDENCY-POLICY.md`
7. `docs/contributor/QUALITY-GATES.md`

Architecture changes require an ADR. Do not silently bypass a binding decision because a library makes another path easier.

## Pull request quality gate

Before opening a PR:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test:browser
```

Add focused tests with behavior changes. A PR that changes project/archive schemas must include migration and fixture implications. A PR that changes exports must include deterministic/golden-test implications.

## TypeScript and module rules

- `strict` stays enabled.
- Do not introduce `any`; validate `unknown` at boundaries.
- Prefer discriminated unions and exhaustive handling for domain variants.
- Domain modules must not import React, browser globals, Dexie, Tailwind, Moveable, Vercel SDKs, or infrastructure adapters.
- React components render state and capture intent; business behavior belongs in application/domain modules.
- Avoid barrel-file chains that hide dependency direction.

## Arabic / English requirements

Hawya treats Arabic and English as first-class product languages.

- Use logical CSS properties/classes (`start`/`end`, inline/block) instead of hard-coded physical direction when meaning is directional.
- UI direction must not mutate or mirror document/canvas coordinates.
- Mixed-direction text and Arabic typography require explicit tests once those surfaces exist.
- Do not hard-code user-visible product text deep inside business/domain code.

## Dependencies

A new dependency must satisfy `docs/contributor/DEPENDENCY-POLICY.md`: explain the problem, license, maintenance/security state, runtime cost, and exit strategy. Do not add SaaS SDKs or hosted AI providers to the core product.

## Formatting and linting

Biome is the repository formatter/linter. Its version is pinned exactly because formatter/linter output must be deterministic in CI.

```bash
pnpm format
pnpm lint
```

## Commit and PR scope

Prefer small, coherent changes that preserve the stage plan. Never use a refactor as cover for changing product behavior or architecture.
