# Stage 07 Implementation Notes — Smart Engines and Audit

Stage 07 adds deterministic smart analysis and project-wide audit behavior on top of the verified Stage 06 editor without changing the local-first architecture or introducing a parallel brand model.

## Architecture split

```text
canonical ProjectSnapshot
  -> pure smart/audit domain
  -> application queries and confirmation/quick-fix use cases
  -> browser/worker analysis adapters
  -> Brand System Smart Audit UI
```

- `src/domain/smart/` owns deterministic logo/raster/contrast calculations and rule inputs.
- `src/domain/audit/audit-engine.ts` owns project-wide findings, severity and typed quick-fix descriptions.
- `ProjectAuditQuery` composes canonical project state, binary availability and the existing ColorEngine.
- `ManageLogoSmartRulesUseCase` owns the measured-versus-user-confirmed rule boundary.
- `ApplyAuditQuickFixUseCase` is the only Stage 07 mutation path for supported audit fixes; React does not mutate project data ad hoc.
- `BrowserLogoAnalyzer` and the existing asset worker keep DOM/pixel APIs behind application ports.

## Logo analysis and professional-rule provenance

SVG/raster analysis persists geometry as `source: "measured"`. It may measure visible bounds, canvas dimensions, padding, aspect ratio, crop candidates and palette candidates.

Clear-space and minimum-size professional rules remain absent until the user explicitly confirms them. Confirmed rules persist as `source: "user"`. Geometry-relative clear-space rules require prior measurement and use a ratio. The Smart Audit UI includes a live clear-space diagram and a live minimum-size preview generated from the selected logo asset, not screenshots.

The eight Do/Don't examples are deterministic visual transformations of the selected logo preview. Saving them records only the user-confirmed rule kinds.

## Project audit

The audit engine reports deterministic findings across:

- missing primary logo, primary color and body style;
- unresolved guide pages and empty guide sections;
- missing project/logo/font/layer asset references and missing local binaries;
- duplicate source hashes, unusually large assets and unsanitized SVG records;
- missing or detached color/text-style tokens;
- stale verified print values;
- Arabic coverage and GSUB/GPOS review signals;
- invalid local overrides and hidden required template slots;
- incompatible semantic page/template bindings;
- zero-size and out-of-page extra layers, including rotated-AABB checks.

Severity is `info | warning | blocking`. Findings are stable-sorted for deterministic output.

## Typed quick fixes

Only deterministic remediations are exposed:

- bind a matching color token;
- fit an unrotated layer to the page;
- show a required template layer;
- remove an invalid local override.

Rotated out-of-bounds layers deliberately do not receive the axis-aligned fit quick fix. Quick fixes revalidate the complete canonical project snapshot before persistence.

## Security and trust boundaries

- an SVG must already be marked sanitized before logo DOM analysis starts;
- no source SVG markup is injected through React;
- external/browser-specific objects never enter the domain;
- raster pixel processing is bounded by the existing worker/preview pipeline;
- audit mutations parse the resulting canonical snapshot through Zod before save.

## RTL and accessibility

Smart Audit copy is available in EN and AR. UI layout uses logical CSS. Logo/document geometry remains physical and is not mirrored when interface direction switches. The critical Chromium path verifies the Arabic interface and fails on Hawya `console.error`, `console.warning` or uncaught `pageerror`.

## Deliberate limits

Stage 07 does not invent unreliable heuristics:

- “near” detached colors are not flagged until an agreed perceptual threshold is part of the product contract;
- automatic logo/background approval is not inferred from an untyped professional rule;
- text overset is not reported without reliable measured layout metrics;
- raster resolution at a requested output size is deferred to Stage 08 export preflight, where target dimensions/DPI exist.

The contrast matrix remains the explicit low-contrast audit surface rather than duplicating every failing pair into the global issue list.
