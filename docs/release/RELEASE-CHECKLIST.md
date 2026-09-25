# Stage 12 Release Traceability

This file maps the binding Project Pack release checklist to concrete Hawya Studio evidence.

**Stage 12 is formally closed. Hawya Studio `v0.1.0` is published.**

Release source of truth:

- tag: `v0.1.0`;
- commit: `82da1460a31300be4e43385b8c6348a0b8201575`;
- tree: `090a190ce534dc2505f5c94e8d2fbd66fcf1134a`;
- GitHub Release: <https://github.com/Bashar-Omar/Hawya-Studio/releases/tag/v0.1.0>;
- Production: <https://hawya-studio.vercel.app>.

| Project Pack release gate | Final evidence | Status |
| --- | --- | --- |
| clean clone install/build | exact-head and merged-main CI frozen install/build | PASS |
| no required env secrets | static Vite app; no runtime secret contract | PASS |
| EN strings complete | locale catalog + Chromium regression | PASS |
| AR strings complete / visual | AR Settings/project evidence with `lang=ar`, `dir=rtl`; manual visual review | PASS |
| project create/save/reopen | browser regression + anonymous Production create/reload journey | PASS |
| `.hawya` round trip | archive unit/integration + Stage 11 semantic matrix | PASS |
| previous schema migrations | checked v1 fixture + migration tests | PASS |
| logo/color/font/assets core | browser regression + release evidence | PASS |
| editor transform/history | historical regression suite | PASS |
| token propagation | unit/integration + browser regression | PASS |
| export golden suite | Stage 08 browser exports + Stage 11 semantic goldens | PASS |
| PDF print workflow | 9-page bilingual PDF; rendered manual review; zero overflowing text layers | PASS |
| malicious SVG/ZIP fixtures | Stage 11 adversarial/security tests | PASS |
| Chromium/Firefox/WebKit smoke | PR exact-head + merged-main compatibility/regression matrix | PASS |
| offline shell smoke | PWA regression + anonymous Production offline reload | PASS |
| storage failure/emergency backup | Stage 11 application + browser recovery coverage | PASS |
| accessibility + keyboard | Stage 10 automation + 12-step keyboard trail | PASS |
| dependency security | production high/critical audit gate | PASS |
| license / third-party assets | notices + license inventory + deterministic app-icon provenance/validator | PASS |
| Vercel production smoke | exact-SHA Production + direct-route HTTP + anonymous Chromium create/reload/offline journey | PASS |
| project-format docs | format + migration/versioning docs reviewed and release-gated | PASS |
| changelog + release tag | `v0.1.0` published from exact merged-main SHA | PASS |
| large local asset corpus | 128 MiB IndexedDB Blob corpus survived reload byte-for-byte | PASS |
| fallback static deployment | repository-path build checker + Chromium hash-route/PWA/offline acceptance | PASS |

## Final public-release checkpoint

- PR #23: merged with expected-head guard;
- merged-main SHA: `82da1460a31300be4e43385b8c6348a0b8201575`;
- merged-main tree: `090a190ce534dc2505f5c94e8d2fbd66fcf1134a`;
- merged-main CI run: `36147092428` — SUCCESS;
- final release-candidate PR CI run: `36146751752` — SUCCESS;
- final PR Production smoke artifact:
  `stage12-production-smoke-c808cf5cef09c0a09b4a91e5d7f44a721c5b92af`;
- Production smoke artifact ID: `10870371269`;
- Production smoke artifact digest:
  `sha256:205a17fb00f8e1d6ba3551b23264a35292a839fa1a3465e6d06e94459270ad88`;
- exact merged-main Production deployment: `dpl_4eecsQ6K4smwugwKCbZuYkK26skt` — READY;
- Production URL: `https://hawya-studio.vercel.app`;
- public release tag: `v0.1.0` -> exact merged-main SHA;
- GitHub Release ID: `396679460`;
- public source ZIP asset ID: `588536384`;
- source ZIP SHA256:
  `cf7c55ae094c208d66cac02f0d1c5bd81dc26373613e406750cd2c73f98a89da`;
- final handoff verification asset ID: `588618612`;
- final handoff verification SHA256:
  `aed2e8a3aa2affe389f46d63c4ba7935b0f3c52cdd8bb316aef42743b71c9e8f`;
- initial publisher run: `36147883320` — SUCCESS;
- provenance-correction run: `36152837962` — SUCCESS.

The provenance-correction run replaced only the handoff verification asset after an audit found that
the original verification file paired the final PR run with an older Production-smoke artifact ID.
The release tag, release source ZIP, merged-main commit, and Production deployment were correct and
unchanged.

## Release evidence carried forward

The audited release evidence verifies:

- English and Arabic/RTL UI evidence;
- 12-step keyboard focus trail;
- 16 × 8 MiB local binary Blobs = 128 MiB persisted before and after browser reload;
- bilingual Print View and a 9-page Chromium PDF;
- zero overflowing Print View text layers;
- no browser console warnings/errors;
- direct routes `/`, `/studio`, `/settings`, `/about`, and `/studio/new`;
- root-scoped manifest/service worker;
- project creation, durable reload, and offline project-route reload.

Manual PDF review previously caught a real bilingual Production Checklist clipping defect. The
bilingual template geometry was corrected at the template boundary and protected by unit + browser
overflow regressions before release.

## Known operational limitation

Repository-admin branch-protection state could not be verified or mutated through the connected GitHub
integration. Public rulesets enumerated empty during Stage 12. Release integrity therefore used an
explicit expected-head/no-direct-main workflow, full PR CI, merged-main CI, exact merged-SHA
Production deployment, exact tag verification, and independently checked release assets.

This is a repository-governance limitation, not a known product-runtime, data-loss, security, or
release defect.

## Closure result

All binding Stage 12 gates are complete. The implementation roadmap defined in the Project Pack
(Stages 00–12) is complete for the first public release. Future work starts from post-release
maintenance and evidence-driven product planning rather than an unplanned Stage 13.
