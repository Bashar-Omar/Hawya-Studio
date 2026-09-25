# Stage 12 Release Traceability

This file maps the binding Project Pack release checklist to concrete Hawya Studio evidence. The
release candidate has passed implementation, release-evidence and live-production gates. Formal
public-release closure occurs only after exact-head merge, merged-main CI, exact merged-SHA production
verification and the `v0.1.0` tag/release.

| Project Pack release gate | Final candidate evidence | Status |
| --- | --- | --- |
| clean clone install/build | CI frozen install + exact-head production build | PASS |
| no required env secrets | static Vite app; no runtime secret contract | PASS |
| EN strings complete | locale catalog + Chromium regression | PASS |
| AR strings complete / visual | AR Settings/project evidence with `lang=ar`, `dir=rtl`; manual visual review | PASS |
| project create/save/reopen | historical browser suite + anonymous Production create/reload journey | PASS |
| `.hawya` round trip | archive unit/integration + Stage 11 semantic matrix | PASS |
| previous schema migrations | checked v1 fixture + migration tests | PASS |
| logo/color/font/assets core | historical browser regression + release evidence | PASS |
| editor transform/history | historical regression suite | PASS |
| token propagation | unit/integration + browser regression | PASS |
| export golden suite | Stage 08 browser exports + Stage 11 semantic goldens | PASS |
| PDF print workflow | 9-page bilingual PDF; rendered manual review; zero overflowing text layers | PASS |
| malicious SVG/ZIP fixtures | Stage 11 adversarial/security tests | PASS |
| Chromium/Firefox/WebKit smoke | exact-head CI compatibility/regression matrix | PASS |
| offline shell smoke | historical PWA test + anonymous Production offline reload | PASS |
| storage failure/emergency backup | Stage 11 application + browser recovery coverage | PASS |
| accessibility + keyboard | Stage 10 automation + 12-step keyboard trail | PASS |
| dependency security | production high/critical audit gate | PASS |
| license / third-party assets | notices + license inventory + deterministic app-icon provenance/validator | PASS |
| Vercel production smoke | exact-SHA Production + direct-route HTTP + anonymous Chromium create/reload/offline journey | PASS |
| project-format docs | format + migration/versioning docs reviewed and release-gated | PASS |
| changelog + release tag | `v0.1.0` changelog prepared; tag/release intentionally post-merge | CLOSURE PENDING |
| large local asset corpus | 128 MiB IndexedDB Blob corpus survived reload byte-for-byte | PASS |
| fallback static deployment | repository-path build checker + Chromium hash-route/PWA/offline acceptance | PASS |

## Final release-candidate checkpoint

- candidate source HEAD: `d7fa373c450e4c8bf1800c19b972a9ecd7e5d247`;
- CI run: `36146124481` — SUCCESS;
- exact-head release-evidence job: PASS;
- Production smoke job: PASS;
- Production smoke artifact: `stage12-production-smoke-d7fa373c450e4c8bf1800c19b972a9ecd7e5d247`;
- Production smoke artifact ID: `10870280299`;
- Production smoke artifact digest:
  `sha256:9ee86b7efd216ea23beb7ab7cdf25736689f60af86bfb0d8795b6ebb17be69e5`;
- Production URL: `https://hawya-studio.vercel.app`;
- exact-head Production deployment: `dpl_AQYXhURKoXX4kPF5AYs4TqPFXC6J` — READY;
- build log explicitly checked out `d7fa373c450e4c8bf1800c19b972a9ecd7e5d247`;
- live `/studio`, `/settings`, manifest and generated PWA assets return 200 with release security
  headers;
- Vercel runtime-error query after deployment: no runtime errors found;
- anonymous Production journey verified project creation, durable reload, service-worker registration,
  shell-only cache behavior and offline project-route reload with no browser runtime issues.

## Release evidence carried forward

The exact-head release artifact verifies:

- English and Arabic/RTL UI evidence;
- 12-step keyboard focus trail;
- 16 × 8 MiB local binary Blobs = 128 MiB persisted before and after browser reload;
- bilingual Print View and a 9-page Chromium PDF;
- zero overflowing Print View text layers;
- no browser console warnings/errors.

Manual PDF review previously caught a real bilingual Production Checklist clipping defect. The
bilingual template geometry was corrected and protected with unit and browser overflow regressions.
The corrected evidence was re-rendered and manually reviewed successfully.

## Known operational limitation

Repository-admin branch-protection state cannot be verified or mutated through the connected GitHub
integration. Public rulesets enumerated empty during Stage 12. Release integrity therefore relies on
the explicit expected-head workflow used here: no direct `main` pushes, exact-head CI, PR merge,
merged-main CI, and exact merged-SHA deployment verification.

This is a repository-governance limitation, not a known product-runtime, data-loss, security or
release-candidate defect.

## Formal closure sequence

1. This documentation head must pass the full PR CI matrix, including Production smoke.
2. PR #23 must move out of Draft and merge without changing the verified head unexpectedly.
3. The exact merged `main` SHA must pass merged-main CI.
4. Production must be rebuilt/deployed from that exact merged SHA and smoke-checked.
5. Create public tag/release `v0.1.0` from that exact merged SHA.
6. Generate the final Stage 12 handoff verification artifact/ZIP from the exact merged tree.

Do not create the public version tag before steps 1–4 are green.
