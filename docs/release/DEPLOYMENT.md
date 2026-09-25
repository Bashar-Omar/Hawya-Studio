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

GitHub Pages is the documented fallback for a repository-path static host. Build the fallback artifact
with:

```bash
pnpm build:static-fallback
pnpm check:static-fallback
```

That build uses Vite base `/Hawya-Studio/`, hash-based application routes under the non-root base, a
base-scoped service worker, and a rewritten manifest `start_url`/`scope`/icon set. Hash routing is used
only for non-root builds so the primary root-hosted Vercel deployment keeps clean History API URLs.

The automated build gate verifies base-scoped HTML assets, manifest fields and service-worker shell
paths. Stage 12 still requires a browser smoke of the produced fallback artifact before public release;
a static file check alone is not treated as end-to-end evidence.
