# Stage 01 Completion Record — App Shell, UI & RTL Foundation

Status: **complete — Stage 01 gate is green.**

## Scope completed

- bilingual English/Arabic application shell with UI locale switching;
- html lang and dir follow UI locale without introducing document/editor state;
- Landing, Studio Home skeleton, Settings, About, and not-found routes;
- lightweight History API routing with typed route configuration;
- responsive application chrome with desktop navigation rail and narrow-screen navigation dialog;
- semantic System / Light / Dark appearance preferences;
- non-critical UI preferences stored locally in the browser;
- command registry, global command shortcut, command menu, and shortcut reference dialog;
- accessible dialog primitives, deterministic initial focus, trigger-based focus restoration, live region, skip link, and visible focus treatment;
- logical CSS properties and first-class LTR/RTL layout behavior;
- self-hosted Inter and Noto Sans Arabic variable fonts;
- dependency, third-party, and font-license records;
- Stage 01 unit and Chromium E2E coverage.

Stage 01 intentionally does **not** implement project persistence, the .hawya archive, the brand/project domain model, or editor geometry. Those remain later-stage responsibilities.

## Architecture decisions changed

None.

ADR-001 through ADR-007 remain accepted and unchanged. No persistence, project-schema, export, backend, or cost-model decision was altered.

## Dependencies introduced

All Stage 01 dependencies were reviewed under docs/contributor/DEPENDENCY-POLICY.md and recorded in docs/contributor/STAGE-01-DEPENDENCY-REVIEW.md.

Runtime additions:

- @base-ui/react@1.8.0 — accessible headless dialog/direction primitives;
- lucide-react@1.47.0 — source-owned SVG icon components;
- @fontsource-variable/inter@5.3.0 — self-hosted Latin UI font;
- @fontsource-variable/noto-sans-arabic@5.3.0 — self-hosted Arabic UI font.

No paid API, SaaS SDK, account system, analytics tracker, runtime secret, or hosted font dependency was introduced.

## Gate evidence

Final feature-gate CI run: 35437643352 on PR #6 (Stage 01: App Shell, UI & RTL Foundation).

### Quality gate — passed

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build

The aggregate check passed:

- Biome formatting verification;
- Biome lint with zero reported errors;
- TypeScript 7 strict project build/typecheck;
- Vitest unit tests.

The production Vite build also passed.

### Chromium smoke / E2E — passed

    pnpm exec playwright install --with-deps chromium
    pnpm build
    pnpm test:browser

Result: **8 passed**.

The browser suite verifies:

- Landing, Studio Home, Settings, and About render without Hawya console errors;
- shell routes do not horizontally overflow;
- UI language switching updates lang / dir and preserves navigation;
- Arabic and English shell layouts remain usable;
- Dark/Light preference changes affect application chrome and survive reload;
- command menu opens from the global keyboard shortcut and exits cleanly;
- command dialog opened from its trigger restores focus to that trigger;
- shortcut dialog can be entered/exited from the keyboard and restores focus;
- narrow-screen navigation remains accessible and overflow-free.

## Accessibility / RTL notes

- UI direction uses logical CSS properties rather than hard-coded physical left/right layout assumptions.
- UI locale/direction remains separate from future document/editor coordinate systems.
- Dialog focus ownership is delegated to Base UI trigger/root primitives rather than forced DOM focus hacks.
- The shared Button primitive forwards React refs to the real DOM button, preserving primitive composition and focus contracts.
- Reduced-motion handling avoids broad !important overrides.
- Semantic fieldset/legend and figure/caption structures replaced invalid or unnecessary ARIA grouping.

## Repository hygiene

- temporary Stage 01 transport chunks were removed after verified materialization;
- temporary Stage 01 materializer workflow was removed;
- the PR now contains ordinary source files and the committed deterministic lockfile;
- no build output, node_modules, test artifacts, environment files, or secrets are committed;
- stale Stage 01 PRs #4 and #5 were closed; PR #6 is the canonical Stage 01 change.

## Files changed by Stage 01

Documentation / dependency records:

- README.md
- docs/contributor/STAGE-01-DEPENDENCY-REVIEW.md
- docs/licenses/FONT-LICENSES.md
- docs/licenses/THIRD-PARTY-NOTICES.md
- docs/stages/STAGE-01-COMPLETION.md
- package.json
- pnpm-lock.yaml

Application shell and routing:

- src/app/App.tsx
- src/app/app-metadata.ts
- src/app/commands/command-registry.ts
- src/app/providers/AppProviders.tsx
- src/app/providers/ui-preferences.tsx
- src/app/providers/ui-preferences.test.ts
- src/app/routes/NotFoundPage.tsx
- src/app/routes/RouterProvider.tsx
- src/app/routes/route-config.ts
- src/app/routes/route-config.test.ts

Cross-application UI:

- src/components/app/AppShell.tsx
- src/components/app/CommandMenu.tsx
- src/components/app/LanguageSwitcher.tsx
- src/components/app/LiveRegion.tsx
- src/components/app/NavigationRail.tsx
- src/components/app/ShortcutDialog.tsx
- src/components/app/SkipLink.tsx
- src/components/app/ThemeSwitcher.tsx
- src/components/ui/button.tsx
- src/components/ui/dialog.tsx
- src/components/ui/segmented-control.tsx

Feature screens:

- src/features/about/AboutPage.tsx
- src/features/landing/LandingPage.tsx
- src/features/project-library/StudioHomePage.tsx
- src/features/settings/SettingsPage.tsx

Internationalization / preferences:

- src/i18n/I18nProvider.tsx
- src/i18n/i18n.test.ts
- src/i18n/messages/ar.ts
- src/i18n/messages/en.ts
- src/i18n/translate.ts
- src/i18n/types.ts
- src/infrastructure/preferences/browser-preference-store.ts
- src/infrastructure/preferences/browser-preference-store.test.ts

Entry point, styling, browser tests:

- src/main.tsx
- src/styles/globals.css
- tests/e2e/smoke.spec.ts
- tests/e2e/stage01-shell.spec.ts

## Known limitations / deliberate deferrals

- Studio Home uses an honest empty/skeleton project state; creating/opening/persisting real projects belongs to Stage 02.
- No IndexedDB/Dexie project persistence is implemented yet.
- No .hawya import/export runtime exists yet.
- No canvas/editor, brand model, asset pipeline, template engine, or export renderer is implemented in this stage.
- Vercel production project linkage remains an external deployment task; the repository remains a static Vite build with no runtime secret.

## Next-stage readiness

**Stage 02 may begin.**

Stage 02 must start from the merged Stage 01 main snapshot plus the binding Hawya Studio Project Pack. It may add project/schema/persistence foundations only within the boundaries defined by the accepted ADRs and Stage 02 specification.
