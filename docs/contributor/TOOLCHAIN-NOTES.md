# Toolchain Notes — Stage 00

This document records a researched Stage 00 tooling adjustment so future contributors do not have to rediscover it.

## TypeScript 7 and linting

The Project Pack binds Hawya Studio to TypeScript 7.x. As of September 2026, the published `typescript-eslint` stack does not support TypeScript 7: its peer range remains below TypeScript 6.1 and known TS7 support reports fail because TypeScript 7's native package does not expose the prior compiler programmatic API yet.

Hawya therefore uses **Biome 2.5.14** for formatting and static linting in Stage 00 instead of adding a knowingly incompatible `typescript-eslint`/ESLint stack.

This is a tooling-level adjustment, not an architecture/product ADR:

- TypeScript 7 strict remains binding.
- The quality gate still has a dedicated lint step and a dedicated typecheck step.
- Biome is pinned exactly because formatter/linter behavior must remain deterministic across contributors and CI.
- Re-evaluate ESLint only if a future capability is genuinely needed and its TypeScript 7 integration is officially supported.

Research references:

- TypeScript 7 announcement: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- typescript-eslint TS7 support report: https://github.com/typescript-eslint/typescript-eslint/issues/12518
- Biome installation/version pinning: https://biomejs.dev/guides/getting-started/
- Biome releases: https://github.com/biomejs/biome/releases

## shadcn/ui RTL bootstrap

`components.json` is configured with `style: base-nova` and `rtl: true` from Stage 00. The application does **not** force the whole product to RTL yet: Stage 01 owns the runtime language/direction provider. This preserves the Project Pack rule that interface direction and canvas/document direction are separate concerns.

No shadcn component package/dependency is preinstalled until a component is actually used. The CLI remains source-generation infrastructure, not a runtime SaaS dependency.

Reference: https://ui.shadcn.com/docs/rtl/vite

## Vercel

Hawya remains a plain Vite static build. Vercel can detect Vite and serve the build output; no Vercel runtime API is required. `vercel.json` states the static build contract explicitly for reproducibility. There are no environment variables or secrets in the core build.

Reference: https://vercel.com/docs/frameworks/frontend/vite

## GitHub Actions runtime bootstrap

CI uses `pnpm/setup@v2.1.0` with the repository-pinned pnpm `12.4.2` and Node.js `24.21.0`. pnpm 12 ships a standalone executable, and `pnpm/setup` can install both pnpm and the requested Node runtime without Corepack or a global npm install. The workflow still runs `pnpm install --frozen-lockfile` explicitly so lockfile reproducibility remains visible in the quality gate.

References:

- https://github.com/pnpm/setup
- https://github.com/pnpm/setup/releases/tag/v2.1.0
- https://nodejs.org/en/blog/release
