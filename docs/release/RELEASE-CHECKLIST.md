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
| AR strings complete / visual | Arabic catalog + RTL automation | Manual pending |
| project create/save/reopen | browser regression | Covered / rerun pending |
| `.hawya` round trip | archive unit/integration + Stage 11 semantic matrix | Covered / rerun pending |
| previous schema migrations | checked v1 fixture + migration tests | Covered / rerun pending |
| logo/color/font/assets core | historical regression suite | Covered / rerun pending |
| editor transform/history | historical regression suite | Covered / rerun pending |
| token propagation | unit/integration + browser regression | Covered / rerun pending |
| export golden suite | Stage 08 browser exports + Stage 11 semantic goldens | Covered / rerun pending |
| PDF print workflow | browser Print View exists | Manual pending |
| malicious SVG/ZIP fixtures | Stage 11 adversarial/security tests | Covered / rerun pending |
| Chromium/Firefox/WebKit smoke | Stage 11 matrix | Covered / rerun pending |
| offline shell smoke | Stage 10 PWA browser test | Covered / rerun pending |
| storage failure/emergency backup | Stage 11 app + cross-browser recovery test | Covered / rerun pending |
| accessibility + keyboard | Stage 10 automated coverage | Manual pending |
| dependency security | `pnpm check:security` in CI | Covered / rerun pending |
| license / third-party assets | direct dependency notices updated; CI inventory exists | Stage 12 pending |
| Vercel production smoke | current production is intentionally still Stage 09 | Stage 12 pending |
| project-format docs | versioned v1/v2 implementation docs exist | Stage 12 pending review |
| changelog + release tag | changelog draft exists; tag intentionally absent | Stage 12 pending |
| large local asset corpus | Stage 10 scale fixture is metadata-scale, not 100-250 MB corpus | Manual pending |
| fallback static deployment | base-aware fallback build + static artifact checker added | Stage 12 pending browser smoke |

## Known release blockers / open evidence

1. **Static-host browser evidence.** A base-aware `/Hawya-Studio/` build and artifact checker now exist,
   but the fallback is not release-complete until Stage 12 executes it in a browser and verifies hash
   navigation, PWA scope and offline behavior.
2. **App-icon provenance.** The repository contains `public/icons/hawya-192.png` and
   `public/icons/hawya-512.png`, but the available project history does not document their creation or
   redistribution provenance. Confirm or replace them with demonstrably project-owned/generated
   assets before the public tag.
3. **Manual release evidence.** Arabic visual review, keyboard pass, Print / Save-to-PDF inspection and
   the practical 100-250 MB local corpus exercise remain intentional Stage 12 checks.
4. **Repository governance.** Public rulesets currently enumerate as empty, while the connected GitHub
   integration cannot read or mutate legacy branch-protection administration. Final release must not
   rely on an unverified protection assumption; the established expected-head/no-direct-main workflow
   remains mandatory.

## Release decision rule

Do not create the public version tag while any item above is blocked or while a release-specific
manual/production gate required by the Project Pack remains incomplete.
