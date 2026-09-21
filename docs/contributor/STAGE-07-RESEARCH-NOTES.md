# Stage 07 Research Notes — Smart Engines and Audit

Research date: 2026-09-21.

## Deterministic automation boundary

Stage 07 follows ADR-007: geometry, color math, font analysis, audits and Do/Don't transformations are deterministic and inspectable. No generative model, cloud API, account, runtime secret or paid service is introduced. Professional logo rules are never promoted from a measurement or suggestion into an authoritative rule without explicit user confirmation.

## SVG geometry

The browser analyzer works only after Hawya's existing SVG ingestion/sanitization boundary marks an SVG as sanitized. The analyzer parses the sanitized bytes as SVG, mounts an off-screen imported SVG node, and uses the browser's SVG geometry API to measure the rendered bounding box. The canonical measurement stores visible bounds, padding, aspect ratio, a normalized crop suggestion and palette candidates. It does not preserve or reinject source markup into React.

MDN documents `getBBox()` as returning the coordinates of the smallest rectangle in which the rendered graphics fit. Hawya keeps the analyzer behind the `LogoAnalyzer` port so browser measurement remains infrastructure rather than domain logic.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getBBox

## Raster analysis in a worker

Raster decoding remains off the main UI path through the existing asset worker. Browser `createImageBitmap()`, `OffscreenCanvas` and pixel reads produce deterministic alpha bounds, normalized crop data and a bounded perceptually de-duplicated palette. The domain receives plain values rather than browser/library objects.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/createImageBitmap

## Color accessibility

Stage 07 reuses the Stage 04 Color.js adapter instead of introducing a second color implementation. A deterministic bounded subset of meaningful brand-token pairs is selected, then the existing color engine computes WCAG 2.1 contrast ratios. The UI reports ratio plus AA/AAA results without claiming that every possible token pair is meaningful.

## Typography signals

Existing fontkit worker analysis remains the source for Unicode coverage and GSUB/GPOS presence. Stage 07 treats those as technical signals only. Coverage/table detection is not presented as a certification of Arabic typographic quality.

## E2E assertion strategy

Playwright locator assertions are used against semantic state. For native inputs/selects the Stage 07 path uses value assertions rather than assuming an `option` node itself is visibly rendered. Ambiguous short labels such as the editor's `X` inspector field are matched exactly so they cannot collide with longer ARIA labels.

Reference: https://playwright.dev/docs/api/class-locatorassertions

## Dependency decision

No Stage 07 dependency is added. The implementation reuses the existing Color.js, fontkit, DOMPurify, worker, Zod and browser-platform capabilities already reviewed in earlier stages.
