# Stage 12 Completion Report — Deploy & Public Release

Date: 2026-09-25  
Stage: 12 — Deploy & Public Release  
PR: #23 — **merged**  
Verified Stage 11 baseline: `3699243c40b544983685ef1490a3569f3c5d6735`  
Final merged-main release SHA: `82da1460a31300be4e43385b8c6348a0b8201575`  
Final merged-main tree: `090a190ce534dc2505f5c94e8d2fbd66fcf1134a`  
Release tag: `v0.1.0`

## Result

**Stage 12 is formally closed and Hawya Studio `v0.1.0` is publicly released.**

The binding Stage 12 release-engineering gates are complete: public/open-source documentation,
deterministic production/static builds, license/asset provenance, release evidence, Arabic/RTL and
keyboard review, 128 MiB local persistence stress, bilingual PDF inspection, Vercel SPA deep links,
PWA/offline behavior, merged-main CI, exact merged-SHA Production deployment, public tag verification,
and an independently verified source handoff.

No backend, hosted account, database, server function, paid API, runtime secret, or required paid
resource was introduced.

## Binding Stage 12 gates

- [x] Final production build is reproducible from the lockfile.
- [x] Public repository release docs, deployment instructions and contribution/security docs are present.
- [x] No required environment secrets/server functions/backend are needed for core use.
- [x] Third-party notices, font licenses and asset provenance are release-gated.
- [x] App icons are generated deterministically and validated by CI.
- [x] Vercel automatic Git deployment remains source-controlled off.
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
- [x] Public direct routes and PWA assets return successfully with release security headers.
- [x] Fresh anonymous Production Chromium creates a project, reloads durable state and reloads offline.
- [x] Production browser evidence contains no runtime warnings/errors.
- [x] Exact-head PR merge + merged-main CI + exact merged-SHA Production verification.
- [x] Public `v0.1.0` tag/release from the exact merged SHA.
- [x] Final Stage 12 merged-tree handoff package/verification.

## Architecture decisions

New ADR: **none**.

Stage 12 preserved the established Clean Architecture boundaries. Product-domain behavior was not
moved into deployment/release infrastructure. Release work stayed in build/configuration, browser
acceptance, documentation, and narrow defects exposed by those gates.

The root-hosted application remains a History API SPA. Vercel has an explicit catch-all rewrite to
`/index.html`. Repository-path fallback builds use a separate base-aware hash-routing mode so
root-host semantics remain clean.

## Schema, persistence and dependency impact

- canonical project schema: **v2**;
- IndexedDB physical schema: **unchanged** in Stage 12;
- portable archive format: **unchanged** in Stage 12;
- migration added in Stage 12: **none**;
- production dependency added in Stage 12: **none**;
- development dependency added in Stage 12: **none**;
- runtime secret/account/backend requirement: **none**.

## Final automated evidence

Final release-candidate PR CI:

- run: `36146751752` — SUCCESS;
- final Production-smoke artifact ID: `10870371269`;
- artifact digest:
  `sha256:205a17fb00f8e1d6ba3551b23264a35292a839fa1a3465e6d06e94459270ad88`.

Merged-main verification:

- merged-main run: `36147092428` — SUCCESS;
- source SHA: `82da1460a31300be4e43385b8c6348a0b8201575`;
- source tree: `090a190ce534dc2505f5c94e8d2fbd66fcf1134a`.

The combined gates cover formatting, lint, strict TypeScript, unit/integration tests, production build,
performance/security/release-doc policies, dependency security/license inventory, full Chromium
regression, Firefox/WebKit compatibility, repository-path static fallback, release evidence, and
Production browser acceptance.

## Production evidence

Final exact merged-main Production deployment:

- deployment ID: `dpl_4eecsQ6K4smwugwKCbZuYkK26skt`;
- status: **READY**;
- alias: `https://hawya-studio.vercel.app`;
- exact checkout:
  `82da1460a31300be4e43385b8c6348a0b8201575`;
- direct project routes verified after deployment;
- Vercel runtime-error query after deployment: **none found**.

The anonymous Production browser evidence verifies:

- direct routes: 200;
- root-scoped standalone manifest;
- active root-scoped `/sw.js`;
- project creation;
- durable reload;
- shell-only cache behavior;
- offline project-route reload;
- no runtime browser issues.

## Public release and handoff

GitHub Release:

- tag: `v0.1.0`;
- Release ID: `396679460`;
- target: exact merged-main SHA;
- draft: **false**;
- prerelease: **false**.

Published source handoff:

- `Hawya-Studio-v0.1.0.zip`;
- asset ID: `588536384`;
- SHA256:
  `cf7c55ae094c208d66cac02f0d1c5bd81dc26373613e406750cd2c73f98a89da`;
- archive integrity: PASS;
- archive entries vs Git tracked files: PASS;
- tracked files: 429;
- forbidden generated/secret-like artifact scan: PASS;
- secret signature scan: PASS.

Final verification asset:

- `STAGE-12-HANDOFF-VERIFY.txt`;
- asset ID: `588618612`;
- SHA256:
  `aed2e8a3aa2affe389f46d63c4ba7935b0f3c52cdd8bb316aef42743b71c9e8f`.

Publisher run `36147883320` completed successfully and removed its one-time branch. A later audit found
that the original verification asset referenced the final PR run but an older Production-smoke
artifact ID. Correction run `36152837962` replaced only the verification asset with the matching
final-PR artifact reference, verified the downloaded replacement byte-for-byte, and removed its
one-time branch. The release tag, source ZIP, merged source, and Production deployment were unchanged.

## Defects found and corrected during Stage 12

### Invalid generated PWA icon evidence

Release audit caught an app-icon quality/provenance gap. Icons now come from a deterministic generator,
are validated in CI, and their provenance is documented.

### Repository-path fallback versus root History API routing

Static fallback needs a repository base path while the primary Vercel app needs clean root History API
URLs. The router/PWA shell explicitly supports the two deployment profiles.

### Bilingual Production Checklist clipping

Manual PDF review found clipped/overlapping Arabic checklist content that automated PDF validity alone
did not detect. The bilingual template geometry was corrected at the template boundary, with unit and
browser overflow regressions preventing recurrence.

### Vercel deep-link 404

Live Production smoke exposed host 404s on History API deep links. An explicit Vercel SPA rewrite was
added and protected by CI policy.

### Exact-SHA deployment race / cached workspace

Release deployment hardening pinned immutable SHAs and removed cached `source`/`dist` workspaces
before exact-source builds.

### Handoff provenance mismatch

The public release source was correct, but a final audit found a mismatched Production-smoke artifact
reference inside the handoff verification text. The verification asset was regenerated with the
matching final-PR artifact ID/digest and independently compared after re-download.

## Known honest limitation

The connected GitHub integration could not verify or mutate legacy branch-protection administration,
and public rulesets enumerated empty during Stage 12. Release integrity therefore used explicit
no-direct-main expected-head discipline, full PR CI, merged-main CI, exact merged-SHA Production
deployment, exact tag verification, and release-asset verification.

No known release product-runtime, security, data-loss, or paid-service blocker remains.

## Next phase

The Project Pack implementation roadmap ends at Stage 12. Stages 00–12 are complete for the first
public release.

Future work is **post-release maintenance and evidence-driven product planning**, not an implicit
Stage 13. Optional ideas under `13-future/` remain deferred until user/community evidence justifies
their scope.
