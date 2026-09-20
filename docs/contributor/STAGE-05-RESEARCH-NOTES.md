# Stage 05 Research Notes — Guide Generator and Templates

Research date: 2026-09-20.

Stage 05 adds no third-party runtime dependency. The implementation stays on the existing React/Vite/browser stack.

## Direction and bilingual rendering

Current MDN and W3C guidance continues to treat text direction as semantic content metadata rather than presentation-only CSS. `dir="auto"` uses first-strong direction detection and directionally isolates inserted content; explicit `dir="ltr"` / `dir="rtl"` remains appropriate when language/direction is known.

Hawya therefore keeps these concerns independent:

- UI locale/direction stays owned by the application shell;
- guide document locale mode is persisted separately as EN, AR, or bilingual;
- template coordinates never mirror when UI locale changes;
- template text containers use semantic `dir`/`lang` behavior rather than string reversal;
- bilingual template arrangements are explicit template metadata.

References reviewed:

- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir
- https://www.w3.org/international/articles/strings-and-bidi/
- https://www.w3.org/International/questions/qa-html-dir

## Feature-boundary loading

React's current `lazy()` API remains the standard component-level dynamic-import boundary, and Vite continues to code-split dynamic imports into separate chunks and preload shared dependencies for async chunks.

The Stage 05 Guide Studio is therefore lazy-loaded at the project route instead of adding the template catalog/preview UI to the initial application shell.

References reviewed:

- https://react.dev/reference/react/lazy
- https://vite.dev/guide/features
- https://vite.dev/guide/build

## Dependency decision

No library is needed for template resolution or semantic binding. Templates are trusted source-controlled declarative data, and the binding resolver is a small explicit allow-list rather than an expression evaluator. This avoids adding a template DSL runtime, arbitrary code execution surface, or new bundle weight.
