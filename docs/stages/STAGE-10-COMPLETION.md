# Stage 10 Completion Report — PWA, Performance & Accessibility Hardening

Date: 2026-09-25  
Stage: 10 — PWA, Performance & Accessibility Hardening  
PR: #21  
Verified Stage 09 baseline: `8e1f30cf69907a547376057b4cf59d01272e534b`  
Product-code verification head: `832ab571644ffc40e5741cabfaea62dc200d5833`  
Product-code verification run: `36077590749`

## Result

Stage 10's binding product scope is implemented and the product-code gate is green.

Hawya now has an installable application manifest, a versioned offline application shell that excludes user project data, measured route/module lazy loading, enforced startup budgets, representative v1-scale fixtures, hardened storage diagnostics, and an application-chrome accessibility pass covering keyboard, focus, touch targets, reduced motion, EN/AR semantics and contrast.

No backend, account, paid API or remote runtime service was introduced.

## Binding gate checklist

- [x] Installable manifest with same-origin start URL/scope and 192 px / 512 px icons.
- [x] Production build generates a versioned offline application shell.
- [x] Service-worker Cache Storage is restricted to the application shell/final build assets.
- [x] Project routes, IndexedDB project records and user binary payloads are not added to service-worker caches.
- [x] An existing locally persisted project opens after the browser is taken offline once the shell is cached.
- [x] Heavy Studio runtime/features are lazy behind route boundaries rather than initialized on the landing route.
- [x] Startup graph size and heavy-module leakage are measured and enforced in CI.
- [x] Representative scale covers 50 pages, 500 layers, 100 asset metadata entries and four project fonts.
- [x] Virtualization is not added without measured evidence at the binding v1 target.
- [x] Editor binary hydration is limited to visual assets referenced by the active scene.
- [x] Storage quota/usage/persistence diagnostics degrade safely when browser APIs are unsupported or reject.
- [x] Browser persistence remains a durability hint; portable `.hawya` backup remains the durable user-owned backup.
- [x] Keyboard command access, skip-link behavior, dialog focus, post-delete layer focus and EN/AR/RTL paths are covered.
- [x] Canvas workspace exposes a semantic EN/AR screen-reader summary while the layer tree remains object navigation.
- [x] `prefers-reduced-motion` disables non-essential chrome motion.
- [x] Compact coarse-pointer controls meet the 44 px Stage 10 touch-target guardrail.
- [x] Light/dark application-chrome contrast pairs are exercised by browser regression tests.
- [x] No remote service is required for the binding offline path.
- [x] Automatic Vercel Git deployments are disabled during development; no Stage 10 preview deployment was created.

## Files changed

The product, test, build and supporting Stage 10 documentation changes span **37 files** before this completion report and README status update.

The work covers:

- CI performance enforcement and build metrics;
- post-build PWA shell generation and registration;
- manifest and install icons;
- lazy route / Studio runtime boundaries;
- representative scale fixture and projection/hydration tests;
- asset-reference query hardening;
- storage-diagnostics tests;
- editor focus and semantic-canvas accessibility;
- reduced-motion, touch-target, contrast and RTL browser coverage;
- Vercel development-deployment policy;
- Stage 10 evidence documents.

## Architecture decisions

New ADR: **none**.

Stage 10 preserves the existing Clean Architecture direction:

```text
landing/application shell
  -> lazy Studio route boundary
  -> Studio runtime / use cases
  -> canonical ProjectSnapshot
  -> projections and active-scene hydration
```

Performance work stays at loading, projection and hydration boundaries. The canonical project model was not flattened or duplicated to obtain smaller bundles or faster rendering.

The PWA boundary is intentionally separate from project persistence:

```text
Cache Storage
  -> versioned static application shell + final build assets only

IndexedDB / binary store
  -> canonical user projects + user binary content
```

The service worker does not become a second project repository.

## Schema and persistence impact

Canonical project schema: **unchanged at v2**.

IndexedDB physical schema: **unchanged**.

Archive format: **unchanged**.

Stage 10 adds no migration and no new runtime dependency.

## Performance evidence

Stage 09 reported the initial application bundle at approximately **228.99 kB gzip**.

The verified Stage 10 product-code build reports:

- initial JavaScript graph: **148,099 bytes gzip**;
- initial graph budget: **163,840 bytes (160 KiB) gzip**;
- initial chunks: **3**;
- per-initial-chunk budget: **128 KiB gzip**;
- heavy startup markers: **none**.

This is approximately a **35% reduction** from the measured Stage 09 gzip baseline.

CI fails if:

- the initial graph exceeds 160 KiB gzip;
- an initial chunk exceeds 128 KiB gzip; or
- `@cantoo/fontkit`, `fflate`, `dompurify`, `colorjs.io`, `react-moveable` or `pdfjs-dist` leaks into the startup graph.

These ceilings are Hawya-specific regression budgets, not universal Web Vital thresholds.

## Representative scale evidence

The deterministic Stage 10 scale fixture contains:

- **50 pages**;
- **500 canonical layers**;
- **100 asset metadata entries**;
- **4 project fonts**.

The verified query test completed in the normal unit/integration gate and validates Guide Studio / Brand System projections plus asset-reference counts. Active-editor hydration is additionally asserted to hydrate only visual binaries referenced by the active scene.

No list virtualization was added because the binding target did not demonstrate a measured need. If later profiling shows UI rendering pressure beyond the v1 target, virtualization belongs in the projection/UI layer without changing canonical data integrity.

### Large local corpus exception

The Project Pack's **100–250 MB** local-asset corpus remains a resource-stress/manual scenario rather than a normal GitHub-hosted CI payload. Hawya's editor path is structured to avoid decoding the entire asset corpus simultaneously, but Stage 10 does **not** claim a hosted-CI 250 MB corpus run.

Broader storage-pressure/adversarial corpus testing remains appropriate for Stage 11.

## PWA / offline evidence

The production build runs PWA generation **after** Vite completes so the final `dist` tree is inventoried. The verified build generated `/sw.js` with **63 offline assets**.

The service worker:

1. pre-caches the versioned application shell and final build assets;
2. serves cached `index.html` for same-origin navigation while offline;
3. serves only paths in the generated shell inventory;
4. does not cache arbitrary application/project routes or project/user data;
5. deletes older `hawya-shell-*` caches after replacement activation.

It deliberately does not call `skipWaiting()`, avoiding an application-code replacement underneath an active editing session.

The Chromium PWA test creates a real local project, confirms the cache boundary, disconnects the browser context, reloads the project route and verifies the Brand System opens without Hawya console warnings/errors.

## Storage diagnostics

Stage 10 keeps the existing `StorageManagerPort` / `BrowserStorageManager` architecture and hardens it rather than adding a duplicate storage layer.

Automated cases cover:

- unsupported storage APIs;
- quota and usage reporting;
- persisted-state reporting;
- persistence requests;
- rejected diagnostic APIs;
- rejected persistence requests.

Failures degrade to explicit unknown/unsupported values rather than crashing the app.

## Accessibility evidence

Stage 10 hardens application chrome toward WCAG 2.2 AA where practical:

- keyboard-first skip link;
- command-menu keyboard access;
- dialog focus handling;
- post-delete layer focus recovery;
- semantic canvas region and EN/AR canvas summary;
- layer tree retained as primary accessible object navigation;
- live status / alert behavior already used by critical paths;
- EN/AR and physical-canvas RTL separation;
- reduced-motion behavior;
- coarse-pointer 44 px compact targets;
- light/dark chrome contrast regression checks.

Brand artwork itself is not mutated to force contrast compliance; user content remains a diagnostic concern rather than an application-chrome override.

## Automated verification

GitHub Actions run **36077590749** on product-code head `832ab571644ffc40e5741cabfaea62dc200d5833`:

### Quality gate

- formatting: PASS
- Biome lint: PASS
- TypeScript strict: PASS
- unit/integration: **32 files / 84 tests PASS**
- production build: PASS
- PWA shell generation: PASS — **63 offline assets**
- performance budget: PASS — **148,099 / 163,840 gzip bytes**

### Chromium gate

- **34 / 34 tests PASS**
- browser suite: approximately **1.2 minutes**
- includes Stage 10 PWA/offline and accessibility coverage plus the existing Stage 01–09 critical paths.

No Playwright timeout threshold was raised and no accessibility/performance threshold was lowered to obtain the green gate.

## Deployment and repository governance

Development deployment policy is source-controlled through:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

Live Vercel history was checked after the product-code gate and contains **zero deployments** from `stage-10-pwa-performance-a11y`. The latest deployments remain Stage 09, so Stage 10 commits did not consume Preview deployment quota.

Repository governance has one external limitation: the connected GitHub App does not have repository-administration access to inspect or mutate the branch-protection endpoint, and no repository ruleset is visible through the accessible ruleset API. Therefore this report does **not** claim that `main` is technically protected.

The Stage 10 merge procedure compensates operationally by using:

- an isolated Draft PR;
- green CI on the exact PR head;
- no direct push to `main`;
- expected-head SHA protection on the squash merge;
- CI again on the exact merged `main` SHA.

Repository-admin branch protection remains recommended.

## Security / reliability review

A PR-wide added-code scan was performed on the product-code head:

- no `TODO` / `FIXME` / `HACK` debt added;
- no TypeScript suppression added;
- no `dangerouslySetInnerHTML`;
- no `eval` / `new Function`;
- no remote URL/runtime service dependency added;
- no new package dependency;
- no unresolved PR review thread.

The only newly observed `fetch()` calls are the same-origin service-worker network fallback and the browser test that fetches the linked manifest.

## Bugs and corrections found during the gate

### Final build inventory for offline chunks

PWA generation was moved to a post-build inventory so lazy chunks emitted by the completed Vite build are included in the offline shell. This avoids relying on an incomplete intermediate bundle view.

### Immutable shell response matching

Offline shell lookups use `ignoreSearch` / `ignoreVary` for the generated immutable shell inventory, preventing valid cached build assets from missing because of request variance.

### Shared asset-reference counting

Brand-system asset usage was hardened so repeated canonical references are aggregated correctly instead of relying on repeated broad scans.

### Active-scene editor hydration

Editor binary loading now derives a hydration plan from the active rendered scene, avoiding unnecessary full-project asset hydration at scale.

### Layer focus after deletion

Layer-tree deletion now selects/focuses a deterministic neighboring layer instead of leaving keyboard focus on a removed element.

### Accessibility measurement stability

The touch-target regression waits for dialog entry animation to settle before measuring the final target box, and the contrast helper accepts browser-computed CSS color serialization rather than assuming raw hex strings. Thresholds were not relaxed.

## Known honest limitations

- The 100–250 MB local corpus is documented as a Stage 10 resource-stress exception rather than committed to normal hosted CI.
- Stage 10 validates Chromium for the binding browser gate; broad Chromium/Firefox/WebKit compatibility is a Stage 11 concern.
- Browser persistent-storage requests remain browser-controlled hints and are not backup guarantees.
- Service-worker update UX is intentionally conservative; no forced mid-session worker takeover is used.
- Repository-admin branch protection is not configurable through the current GitHub integration and remains a governance follow-up.
- Security adversarial fixtures, CSP release validation, dependency/license inventory and simulated emergency backup under storage failure remain Stage 11 scope.

## Next-stage readiness

Stage 11 — **Security, Compatibility & Golden QA** — is ready after the Stage 10 final handoff.

The next stage should focus on adversarial SVG/ZIP/font/image fixtures, schema migration fixtures, Chromium/Firefox/WebKit coverage, RTL stress, export golden comparisons, CSP validation, dependency/license/security inventory, and emergency-backup behavior under simulated storage failure.

## Final handoff gates

The product-code gate is green. After this report and README status update are committed:

1. verify CI on the exact documentation PR head;
2. mark PR #21 ready for review;
3. squash-merge using expected-head SHA protection;
4. verify CI on the exact merged `main` SHA;
5. generate the Stage 10 handoff ZIP from that exact merged SHA;
6. independently verify SHA-256, ZIP integrity, archive entries vs Git tree, forbidden generated/secret-like artifacts and critical Git blobs.

The exact merged SHA and final handoff checksum belong in the external Stage 10 handoff verification artifact created after merge.
