# Stage 12 Release Traceability

This file maps the binding Project Pack release checklist to concrete Hawya Studio evidence. It is a
release-control document, not a substitute for running the gates again on the final release
candidate.

Status meanings:

- **Covered / rerun pending** — an automated or previous-stage gate exists, but Stage 12 still reruns it
  on the exact release candidate.
- **Stage 12 pending** — release-specific verification has not happened yet.
- **Manual pending** — requires human-visible/manual release evidence.
- **Blocked** — a known release requirement is not yet satisfied.

| Project Pack release gate | Current evidence | Stage 12 status |
| --- | --- | --- |
| clean clone install/build | CI uses frozen install + production build | Covered / rerun pending |
| no required env secrets | static Vite app; no runtime secret contract | Covered / rerun pending |
| EN strings complete | existing locale catalog + browser regression | Covered / rerun pending |
| AR strings complete / visual | exact-head release artifact: AR settings + project screenshots, `lang=ar`, `dir=rtl`, manual visual review PASS | Covered / rerun pending |
| project create/save/reopen | browser regression | Covered / rerun pending |
| `.hawya` round trip | archive unit/integration + Stage 11 semantic matrix | Covered / rerun pending |
| previous schema migrations | checked v1 fixture + migration tests | Covered / rerun pending |
| logo/color/font/assets core | historical regression suite | Covered / rerun pending |
| editor transform/history | historical regression suite | Covered / rerun pending |
| token propagation | unit/integration + browser regression | Covered / rerun pending |
| export golden suite | Stage 08 browser exports + Stage 11 semantic goldens | Covered / rerun pending |
| PDF print workflow | exact-head 9-page bilingual PDF + rendered manual review + zero overflowing text layers | Covered / rerun pending |
| malicious SVG/ZIP fixtures | Stage 11 adversarial/security tests | Covered / rerun pending |
| Chromium/Firefox/WebKit smoke | Stage 11 matrix | Covered / rerun pending |
| offline shell smoke | Stage 10 PWA browser test | Covered / rerun pending |
| storage failure/emergency backup | Stage 11 app + cross-browser recovery test | Covered / rerun pending |
| accessibility + keyboard | Stage 10 automation + exact-head 12-step keyboard focus trail | Covered / rerun pending |
| dependency security | `pnpm check:security` in CI | Covered / rerun pending |
| license / third-party assets | direct notices + CI inventory + deterministic app-icon source/validator | Covered / rerun pending |
| Vercel production smoke | current production is intentionally still Stage 09 | Stage 12 pending |
| project-format docs | `.hawya` format + schema migration/versioning docs reviewed against release branch | Covered / rerun pending |
| changelog + release tag | changelog draft exists; tag intentionally absent | Stage 12 pending |
| large local asset corpus | exact-head 128 MiB Blob corpus persisted in Hawya IndexedDB and survived reload byte-for-byte | Covered / rerun pending |
| fallback static deployment | base-aware build + artifact checker + Chromium subpath/PWA/offline acceptance | Covered / rerun pending |

## Stage 12 release-candidate evidence

Exact verified evidence checkpoint:

- source HEAD: `5246178be9c94b3393f3e4bd239c9548b4a0b34a`;
- CI run: `36140135342` — 7/7 jobs PASS;
- artifact: `stage12-release-evidence-5246178be9c94b3393f3e4bd239c9548b4a0b34a`;
- artifact digest: `sha256:f9c1267b754235164eb4d69d792ad8f24b97d5044db096ddae6c9ce611196a1e`;
- Arabic evidence: Settings and project views verified with `lang=ar` / `dir=rtl` and manually
  reviewed with no visible clipping/overlap;
- keyboard evidence: 12 sequential Tab stops resolved to focusable controls/links including skip link,
  navigation, language/commands and primary project actions;
- local corpus evidence: 16 × 8 MiB binary Blobs = 128 MiB in Hawya's IndexedDB `binaries` store;
  after browser reload the corpus remained 16 entries / 134,217,728 bytes;
- PDF evidence: 9-page bilingual Chromium PDF, openable/non-encrypted, manual rendered review PASS;
  all print text layers report no client/scroll overflow;
- the manual review caught a bilingual Production Checklist clipping defect on the previous candidate;
  the built-in bilingual checklist geometry was corrected and protected by unit + Stage 08 browser
  overflow regression coverage before this checkpoint;
- runtime browser warning/error evidence: none.

## Known release blockers / open evidence

1. **Production deployment evidence.** Vercel Production is intentionally still on the Stage 09
   release. Stage 12 still needs one intentional exact-SHA production deployment and anonymous
   production smoke covering direct routes, PWA/offline/update behavior, security/static assets and
   the core free local-first journey.
2. **Repository governance.** Public rulesets currently enumerate as empty, while the connected GitHub
   integration cannot read or mutate legacy branch-protection administration. Final release must not
   rely on an unverified protection assumption; the established expected-head/no-direct-main workflow
   remains mandatory.
3. **Public release closure.** The `v0.1.0` tag/release remains intentionally absent until Production
   smoke and exact-head merge/merged-main verification are complete.

## Release decision rule

Do not create the public version tag while any item above is blocked or while a release-specific
manual/production gate required by the Project Pack remains incomplete.
