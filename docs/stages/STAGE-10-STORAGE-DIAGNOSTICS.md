# Stage 10 — Storage Diagnostics

Hawya already exposed storage diagnostics before Stage 10 through the `StorageManagerPort` and `BrowserStorageManager`.

Stage 10 keeps that architecture and hardens it instead of introducing a duplicate persistence layer.

Verified behavior:

- quota and usage come from `navigator.storage.estimate()` when available;
- persistence state comes from `navigator.storage.persisted()`;
- the user can request persistence through `navigator.storage.persist()`;
- unsupported browsers return an explicit unsupported result;
- rejected/blocked browser APIs degrade to unknown values rather than crashing;
- persistence remains a browser durability hint, never a replacement for the portable `.hawya` backup.

The local-first project data continues to live in IndexedDB/binary storage. Service-worker Cache Storage is restricted to the versioned application shell and build assets.
