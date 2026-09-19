# ADR-002 — Vite + React + TypeScript

**Status:** Accepted

## Decision
Use Vite 8.x, React 19.3+, and TypeScript 7.x for the web application. Node 24 LTS for tooling/CI.

## Why not Next.js for core
Next.js static export is viable, but Hawya is almost entirely an interactive client application and deliberately avoids server features. Next's server/client component boundary and static-export restrictions would add concepts without providing meaningful value to the editor. Vite gives a smaller mental model and faster direct client tooling while remaining fully deployable to Vercel.

## Revisit when
A future product genuinely needs server rendering, accounts, hosted public guides, or backend routes. Do not migrate for SEO fashion alone; the marketing landing can be statically rendered/prebuilt separately if needed.
