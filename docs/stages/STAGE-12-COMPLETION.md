# Stage 12 Completion Report — Deploy & Public Release

Date: 2026-09-25  
Stage: 12 — Deploy & Public Release  
PR: #23  
Verified Stage 11 baseline: `3699243c40b544983685ef1490a3569f3c5d6735`  
Release-candidate verification head: `d7fa373c450e4c8bf1800c19b972a9ecd7e5d247`  
Release-candidate CI run: `36146124481`

## Result

The Stage 12 release candidate satisfies the binding release-engineering and public-production gates:
public/open-source release documentation, deterministic production/static builds, license/asset
provenance, exact-head release evidence, Arabic/RTL and keyboard review, 128 MiB local persistence
stress, bilingual PDF inspection, Vercel SPA deep links, PWA/offline behavior, and a fresh anonymous
Production journey.

No backend, hosted account, database, server function, paid API, runtime secret or required paid
resource was introduced.

Formal public-release closure is intentionally separated from candidate verification: the PR still
must merge, merged-main CI must pass, Production must be rebuilt from the exact merged SHA, and
`v0.1.0` must be tagged/released from that same SHA.

## Binding Stage 12 gates

- [x] Final production build is reproducible from the lockfile.
- [x] Public repository release docs, deployment instructions and contribution/security docs are present.
- [x] No required environment secrets/server functions/backend are needed for core use.
- [x] Third-party notices, font licenses and asset provenance are release-gated.
- [x] App icons are generated deterministically and validated by CI.
- [x] Vercel automatic Git deployment remains source-controlled off during release work.
- [x] Root-hosted Vercel direct URLs use an explicit SPA rewrite to `/index.html`.
- [x] The SPA rewrite is protected by the production security-policy gate.
- [x] Repository-path static fallback builds with a base-aware/hash routing strategy.
- [x] Static fallback route/PWA/offline behavior is exercised in Chromium.
- [x] Release evidence captures EN, AR/RTL, keyboard, PDF and local-corpus evidence.
- [x] 128 MiB local IndexedDB corpus survives reload.
- [x] Bilingual Print/PDF is manually reviewed and protected by overflow regression checks.
- [x] Historical Chromium regression remains green.
- [x] Firefox and WebKit compatibility suites remain green.
- [x] Production dependency security audit remains green.
- [x] Exact-head Production build/deploy is verified.
- [x] Public direct routes and PWA assets return successfully with release security headers.
- [x] Fresh anonymous Production Chromium creates a project, reloads durable state and reloads offline.
- [x] Production browser evidence contains no runtime warnings/errors.
- [x] Vercel runtime-error query reports no runtime errors after the exact-head deployment.
- [x] No unresolved PR review thread exists at the pre-completion closure audit.
- [ ] Exact-head PR merge + merged-main CI + exact merged-SHA Production verification.
- [ ] Public `v0.1.0` tag/release from the exact merged SHA.
- [ ] Final Stage 12 merged-tree handoff package/verification.

## Architecture decisions

New ADR: **none**.

Stage 12 keeps the established Clean Architecture boundaries. Product-domain behavior was not moved
into deployment/release infrastructure. Release work stayed in build/configuration, browser
acceptance, documentation and narrow defects exposed by those gates.

The root-hosted application remains a History API SPA. Vercel therefore has an explicit catch-all
rewrite to `/index.html`. Repository-path fallback builds deliberately use a separate base-aware
hash-routing mode so root-host semantics are not compromised.

## Schema, persistence and dependency impact

- canonical project schema: **unchanged at v2**;
- IndexedDB physical schema: **unchanged**;
- portable archive format: **unchanged**;
- migration added: **none**;
- production dependency added: **none**;
- development dependency added: **none**;
- runtime secret/account/backend requirement: **none**.

## Release-candidate automated evidence

GitHub Actions run `36146124481` on
`d7fa373c450e4c8bf1800c19b972a9ecd7e5d247` completed successfully.

It covers:

- formatting, lint, strict TypeScript and unit/integration checks;
- production build, performance, security, release-doc and app-icon policies;
- production dependency audit + license inventory;
- full Chromium regression;
- Firefox/WebKit compatibility;
- repository-path static fallback browser acceptance;
- exact-head Stage 12 release evidence;
- public Production shell equality and anonymous Chromium Production smoke.

## Production evidence

Final candidate Production deployment:

- deployment ID: `dpl_AQYXhURKoXX4kPF5AYs4TqPFXC6J`;
- status: **READY**;
- alias: `https://hawya-studio.vercel.app`;
- build log exact checkout:
  `d7fa373c450e4c8bf1800c19b972a9ecd7e5d247`;
- direct `/studio` and `/settings`: HTTP 200;
- manifest: HTTP 200, root scope/start URL, standalone display;
- production security headers: restrictive CSP, nosniff, no-referrer, restrictive permissions policy;
- Vercel runtime errors after deployment: **none found**.

The anonymous Production smoke artifact:

- artifact ID: `10870280299`;
- digest:
  `sha256:9ee86b7efd216ea23beb7ab7cdf25736689f60af86bfb0d8795b6ebb17be69e5`;
- direct routes `/`, `/studio`, `/settings`, `/about`, `/studio/new`: 200;
- service worker: root scope, `/sw.js`;
- project creation: PASS;
- durable page reload: PASS;
- shell cache excludes project routes: PASS;
- offline project-route reload: PASS;
- runtime issues: none.

## Manual release evidence

The Stage 12 release-evidence workflow produces auditable screenshots/JSON/PDF rather than relying on
conversation-only observations.

The final evidence verifies:

- Arabic Settings/project screenshots with `lang=ar` and `dir=rtl`;
- 12 sequential keyboard focus stops on real controls/links;
- 128 MiB of actual Blob data in Hawya's IndexedDB binary store before and after reload;
- bilingual Print View;
- 9-page, openable/non-encrypted Chromium PDF;
- zero overflowing text layers;
- no runtime browser warning/error.

## Defects found and corrected during Stage 12

### Invalid generated PWA icon evidence

Release audit caught an app-icon quality/provenance gap. Icons now come from a deterministic generator,
are validated in CI, and their provenance is documented rather than relying on opaque committed
binary artifacts.

### Repository-path fallback versus root History API routing

Static fallback needs a repository base path while the primary Vercel app needs clean root History API
URLs. The router/PWA shell now explicitly supports the two deployment profiles rather than applying one
routing assumption to both.

### Bilingual Production Checklist clipping

Manual PDF review found clipped/overlapping Arabic checklist content that automated PDF validity alone
could not detect. The bilingual template geometry was corrected at the template boundary, and unit +
browser overflow regressions prevent recurrence.

### Vercel deep-link 404

Live Production smoke exposed `/studio`, `/settings` and `/about` returning host 404s despite the
client router working from `/`. The fix is an explicit Vercel SPA rewrite, with a CI policy assertion
so the release-critical route contract cannot silently disappear.

### Exact-SHA deployment race / cached workspace

An early release wrapper rejected a branch-head race correctly, and a later cached build workspace
caused Git clone exit 128. The release deployment harness was hardened to remove cached `source` and
`dist` directories, check out the immutable exact SHA and assert that HEAD before building.

## Known honest limitation

The connected GitHub integration cannot verify or mutate legacy branch-protection administration, and
public rulesets enumerated empty during Stage 12. The release therefore uses an explicit no-direct-main
expected-head process and does not claim branch-protection enforcement that could not be verified.

No known release-candidate product-runtime, security, data-loss or paid-service blocker remains.

## Formal closure / next action

This completion report is a pre-merge release checkpoint. Stage 12 is formally closed only when:

1. this completion-documentation head passes the full PR CI matrix;
2. PR #23 is marked ready and merged with the verified head;
3. merged-main CI passes;
4. the exact merged-main SHA is deployed to Production and re-smoked;
5. `v0.1.0` is tagged/released at that exact SHA;
6. the exact merged tree is packaged and independently verified for handoff.
