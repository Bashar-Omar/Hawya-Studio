# Deployment and Static-Host Portability

Hawya Studio is a client-only Vite application. Core product use must not require a server function,
cloud database, hosted authentication, runtime secret, paid API, or maintainer-paid storage service.

## Primary production target: Vercel static hosting

Repository: `Bashar-Omar/Hawya-Studio`  
Production branch: `main`  
Framework: Vite  
Node: 24.x  
Install: `pnpm install --frozen-lockfile`  
Build: `pnpm build`  
Output: `dist/`  
Required environment secrets: **none**

`VITE_HAWYA_SMART_MOCKUPS` is an optional public build-time feature flag; omitting it does not block the
core application and it is not a secret.

During development/hardening the repository keeps Vercel automatic Git deployments disabled in
`vercel.json`. Stage 12 uses intentional deployment of an exact release-candidate SHA so iterative
commits do not consume deployment quota and production evidence remains attributable to one commit.

## Direct URL routing

Hawya uses History API navigation. Production hosting therefore needs SPA fallback behavior so a
refresh of a route such as `/studio`, `/settings`, or a project/editor URL returns `index.html` rather
than a host 404. Vercel release verification must exercise direct navigation and refresh on both
static and project-specific routes.

## PWA expectations

The production build generates `dist/sw.js` after Vite emits the static application. The service
worker caches only the application shell/build assets and uses `index.html` as the offline navigation
fallback. IndexedDB project records and user binary assets are deliberately outside Cache Storage.

Stage 12 production verification covers installability, first load, update behavior, offline shell and
return-to-online behavior from a fresh browser profile.

## Static-host fallback

The architectural fallback is a normal static host such as GitHub Pages. The generated `dist/` tree
contains no server runtime requirement, but **the current root-oriented route/PWA URLs are not yet
certified for a repository subpath such as `/Hawya-Studio/`**.

The Stage 12 fallback gate must verify all of the following before this fallback is marked supported:

1. Vite asset base under a non-root path;
2. application navigation/history paths under the configured base;
3. manifest `start_url`, `scope`, icon URLs and manifest link;
4. service-worker URL, scope, cache keys and navigation fallback;
5. direct-route/static-host fallback behavior;
6. fonts/workers/chunks load without root-path assumptions.

Until that gate is green, the supported production deployment model is a root-hosted static origin
such as the current Vercel project. This document intentionally records the limitation instead of
claiming untested portability.
