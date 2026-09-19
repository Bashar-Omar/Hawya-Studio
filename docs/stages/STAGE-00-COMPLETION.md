# Stage 00 Completion Record — Repository & Toolchain

Status: **implementation prepared; gate evidence is filled after CI and deployment verification.**

## Scope completed

- public repository foundation;
- MIT license and contributor/security governance;
- Node 24 + pnpm 12 toolchain contract;
- Vite 8.1 + React 19.3 + TypeScript 7 strict scaffold;
- Tailwind 4.3 and shadcn RTL-ready source configuration;
- Biome formatting/linting, Vitest unit tests, Playwright smoke test;
- GitHub Actions CI;
- Vercel static-build configuration;
- Clean Architecture target folders without speculative application code;
- living architecture/project-format/contributor docs copied from the Project Pack.

## Tooling adjustment

The pack's TypeScript 7 requirement conflicts with the current `typescript-eslint` support range. Biome is used for lint/format while `tsc` remains the authoritative type checker. See `docs/contributor/TOOLCHAIN-NOTES.md`.

## Architecture decisions changed

None. Accepted ADRs remain unchanged.

## Gate commands

The Stage 00 gate is:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test:browser
```

## External/manual limitations

GitHub branch-protection settings are repository-host configuration and are not represented in source files. CI is designed to be usable as a required status check for `main` when branch protection is enabled.

## Next stage

Stage 01 may start only after the gate above is green on the committed lockfile and the static production deployment is verified.
