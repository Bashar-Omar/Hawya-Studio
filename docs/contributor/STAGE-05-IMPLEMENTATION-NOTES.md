# Stage 05 Implementation Notes — Guide Generator and Templates

Stage 05 introduces the first generated brand-guideline document while preserving the Project Pack's core split:

```text
Semantic Page Type + PageContent != Visual Template Variant
```

## Domain boundaries

- the full 65-type semantic Page Catalog is represented by stable IDs;
- the initial generated subset is explicitly defined and can expand without changing persisted page content;
- generated pages use `hawya.page-content.v1` semantic PageContent contracts;
- existing legacy `GuidePage.content` records remain readable, so no migration is required just to open older local projects;
- built-in templates are versioned trusted application data, not executable template files;
- template slot roles are mapped to a fixed allow-list of `ContentBinding` paths; no `eval`, arbitrary property traversal, or remote template code exists;
- Brand System values are resolved at query/render time so token edits propagate without rewriting every page.

## Generation behavior

- Minimal, Standard, and Comprehensive profiles select semantic page types;
- Custom explicitly selects semantic page types and may request a page whose required brand data is missing;
- profile generation omits impossible/meaningless pages rather than inventing filler data;
- explicitly requested custom missing pages remain in the guide with a deterministic `Needs input` state;
- pages are grouped into deterministic semantic sections;
- template family and document locale mode are independent generator choices;
- built-in template pack reference is persisted as `builtin-core@1`.

## Template families and bilingual variants

Initial representative pages have built-in templates in:

- Essential — whitespace-first;
- Editorial — asymmetric/type-led;
- Grid — modular/grid-forward.

Bilingual templates include all four required arrangements:

- side-by-side EN/AR;
- stacked EN then AR;
- stacked AR then EN;
- mirrored editorial.

The Guide Studio is a declarative preview surface only. Freeform editor geometry, layer manipulation, history, snapping and undoable commands remain Stage 06.

## Switching and reset

Changing a page template validates semantic page type and locale compatibility, rebinds target slots, and preserves `PageContent`, extras, and local overrides. Reset Layout reapplies the current declarative slot binding after confirmation and also preserves semantic content/extras.

Stage 06 will wrap these mutations in the editor command/history system; Stage 05 does not pre-implement that system.

## Compatibility

`ProjectSettings.guideLocaleMode` is an optional additive field. Older Stage 04 projects infer bilingual mode when both content locales are enabled, otherwise they use the default content locale. Because the field is optional and the existing guide shape remains valid, Project Schema v1 and the IndexedDB database version remain unchanged.
## Verification environment

Stage 05 is verified on the repository's pinned GitHub Actions toolchain (Node 24.21.0 and pnpm 12.4.2). Local runs on unsupported Node versions are not treated as release evidence; the PR quality gate remains authoritative for formatting, linting, strict TypeScript, unit/integration tests, production build, and Chromium browser coverage.
