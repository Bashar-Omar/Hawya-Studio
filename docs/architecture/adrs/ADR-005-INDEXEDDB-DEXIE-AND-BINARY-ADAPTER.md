# ADR-005 — IndexedDB/Dexie with pluggable binary store

**Status:** Accepted

Structured project data and baseline binary assets use IndexedDB through Dexie.

Binary storage is hidden behind `BinaryStore` so a future OPFS adapter can be introduced for very large assets without touching domain code. v1 may ship only IndexedDBBinaryStore if it meets performance tests.

`localStorage` is not used for project documents or assets; it may hold only tiny non-critical bootstrap hints if needed, but preferences should also live in IndexedDB where practical.
