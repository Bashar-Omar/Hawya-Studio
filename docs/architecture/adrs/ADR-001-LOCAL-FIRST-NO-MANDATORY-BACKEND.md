# ADR-001 — Local-first, no mandatory backend

**Status:** Accepted

## Context
The product must be free for maintainer and user, public/open-source, and deployable on Vercel without recurring infrastructure.

## Decision
Core application data stays on the user's device using IndexedDB. Server APIs, auth, remote storage, analytics, AI APIs and database services are not required for core operation.

## Consequences
### Positive
- zero database/storage bill;
- privacy by default;
- offline-friendly;
- no accounts;
- simple static deploy;
- easy forks/self-hosting.

### Negative
- no automatic cross-device sync;
- no realtime collaboration;
- clearing site data can remove projects;
- browser quota matters.

## Mitigation
Portable `.hawya` backups, visible backup status, named local snapshots, storage persistence request, and future repository adapters for optional sync.
