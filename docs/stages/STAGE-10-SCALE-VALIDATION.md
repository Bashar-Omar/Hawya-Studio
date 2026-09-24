# Stage 10 — Representative Scale Validation

The QA target is exercised with a deterministic fixture containing:

- 50 guide pages;
- 500 canonical extra layers (10 per page);
- 100 asset metadata entries;
- the existing bilingual/project schema and archive codec.

The browser test imports the fixture through the real `.hawya` path, verifies the Guide Studio exposes all 50 pages while mounting one active full preview, opens Brand System, and verifies all 100 asset records render without Hawya console warnings/errors. The test logs guide/import and asset-view readiness timings so CI measurements are visible without turning variable hosted-runner timing into a brittle pass/fail threshold.

## Virtualization decision

No virtualization is introduced by default in this slice. The current Guide Studio already mounts one full preview and a metadata-only 50-page rail. The 100-asset grid is validated at the binding v1 target. Virtualization should be added only if representative browser measurements demonstrate interaction or memory pressure; the canonical model must not be flattened to obtain it.

## Large local corpus

The Project Pack also calls for a 100–250 MB local asset corpus stress scenario and explicitly notes that not all large rasters should be decoded simultaneously. That corpus is intentionally a manual/resource stress check rather than a normal GitHub-hosted CI payload. Stage closure records the result or a documented exception.
