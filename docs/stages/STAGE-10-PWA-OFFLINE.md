# Stage 10 — PWA and Offline Shell

Hawya's Stage 10 PWA remains local-first: the service worker caches only the versioned application shell and production build assets. Project snapshots, IndexedDB records and user binary payloads are never inserted into Cache Storage.

## Installability

The linked `manifest.webmanifest` includes the Chromium-oriented minimum installability members:

- name / short name;
- 192 × 192 and 512 × 512 PNG icons;
- same-origin start URL and scope;
- standalone display mode;
- theme/background colors.

Production must be served over HTTPS. Local browser validation uses the loopback origin, which is also eligible for installability testing.

## Offline behavior

The production build performs a post-build inventory of the final `dist` tree so worker chunks and other generated build assets are included. The service worker:

1. pre-caches the shell and final build assets;
2. serves cached `index.html` for same-origin navigations;
3. serves only known shell paths from Cache Storage;
4. does not cache arbitrary routes, API responses or project data;
5. removes older Hawya shell caches after the replacement worker activates.

The browser E2E creates and persists a real local project, disconnects the browser context, reloads the project route and verifies the Brand System still opens without Hawya console warnings/errors.

## Update policy

Stage 10 deliberately does not call `skipWaiting()`. A newly downloaded worker waits until the previous worker is no longer controlling active clients, then activates, deletes older `hawya-shell-*` caches and claims clients. This avoids replacing the application code underneath an active editing session. A user-visible update/reload prompt can be added later if product requirements call for it.
