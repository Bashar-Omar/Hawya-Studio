# Stage 10 — Performance Baseline

This checkpoint records the measured Stage 10 startup baseline and the regression guardrail used by CI.

## Stage 09 baseline

The Stage 09 completion build reported an initial application bundle of approximately **228.99 kB gzip**. This was treated as a measurement problem, not hidden by raising Vite's warning threshold.

## Stage 10 measured result

After moving the Studio runtime and Studio-only routes behind the route boundary, the PR-head production build reports:

- initial JavaScript graph: **147,901 bytes gzip**;
- heavy startup markers: **none**;
- `fflate` no longer ships in the landing startup graph;
- Studio/editor/export/mockup feature code remains lazy.

This is about a **35% reduction** from the measured Stage 09 gzip baseline.

## CI regression ceiling

CI's `check:performance` gate enforces an initial graph ceiling of **160 KiB gzip**, a **128 KiB gzip per-initial-chunk ceiling**, and a zero-tolerance rule for these heavy startup markers:

- `@cantoo/fontkit`
- `fflate`
- `dompurify`
- `colorjs.io`
- `react-moveable`
- `pdfjs-dist`

The 160 KiB ceiling is a Hawya-specific regression guardrail with limited headroom above the measured result. It is not presented as a universal web-performance threshold.

## Architecture decision

No canonical project model was flattened or duplicated for performance. The improvement is entirely at the route/module loading boundary, preserving the Project Pack performance guardrail that optimizations belong in projections, caching, rendering and loading—not data integrity.
