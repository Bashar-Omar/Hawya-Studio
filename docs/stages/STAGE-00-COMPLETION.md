# Stage 00 Completion Record — Repository & Toolchain

Status: **complete — Stage 00 gate is green.**

## Scope completed

- public repository foundation at `Bashar-Omar/Hawya-Studio`;
- MIT license and contributor/security governance;
- Node 24 + pnpm 12 toolchain contract;
- Vite 8.1 + React 19.3 + TypeScript 7 strict scaffold;
- Tailwind 4.3 and shadcn RTL-ready source configuration;
- Biome formatting/linting, Vitest unit tests, Playwright Chromium smoke test;
- committed deterministic `pnpm-lock.yaml` with frozen-install verification;
- GitHub Actions CI with independent quality and browser-smoke jobs;
- Vercel static-build configuration with no runtime secret;
- Clean Architecture target folders without speculative application code;
- living architecture/project-format/contributor docs copied from the Project Pack.

## Tooling adjustment

The Project Pack's TypeScript 7 requirement currently conflicts with the published `typescript-eslint` support line. Hawya therefore uses Biome 2.5.14 for deterministic lint/format while `tsc` remains the authoritative strict type checker. This is a tooling implementation choice only; no product or architecture ADR changed. See `docs/contributor/TOOLCHAIN-NOTES.md`.

Biome's current `linter.rules.preset: "recommended"` configuration is used instead of the deprecated `recommended: true` field.

## Architecture decisions changed

None. ADR-001 through ADR-007 remain accepted and unchanged.

## Gate evidence

Final pull-request CI run: `35410890338` on PR #1 (`Stage 00: repository and toolchain foundation`).

Quality gate job: **passed**.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

The `pnpm check` aggregate passed:

- Biome format verification;
- Biome lint;
- TypeScript 7 strict project build/typecheck;
- Vitest unit tests.

Chromium smoke job: **passed**.

```bash
pnpm exec playwright install --with-deps chromium
pnpm build
pnpm test:browser
```

The smoke test verifies the production preview loads Hawya Studio, both English and Arabic product names render, the local-first foundation marker is visible, and Hawya code produces no browser console error in the tested path.

The bootstrap validation also independently verified the generated source archive checksum, generated the lockfile under Node 24.21.0 + pnpm 12.4.2, completed a frozen install, and passed `pnpm check` + `pnpm build` before the final CI workflow replaced the temporary materializer.

## Repository hygiene verified

- temporary `.bootstrap` transport files removed;
- temporary bootstrap workflow removed;
- TypeScript `.tsbuildinfo` files ignored and not committed;
- no `node_modules`, `dist`, Playwright reports, local Vercel state, or environment secrets committed;
- core build requires no environment variable or secret.

## External repository settings

Branch-protection/ruleset configuration is a GitHub repository-host setting rather than source code. Stage 00 CI exposes stable `Quality gate` and `Chromium smoke` checks so they can be made required checks for `main` when repository rules are configured. The current connector does not expose branch-protection mutation, so no unverified claim is made here.

## Deployment

The repository contains an explicit static Vite `vercel.json` contract. Deployment evidence is recorded in the Stage 00 handoff once the production deployment is verified.

## Next stage

Stage 01 may begin only from the merged Stage 00 handoff/main snapshot. Stage 01 must treat this repository state plus the Hawya Studio Project Pack as its starting source of truth.
