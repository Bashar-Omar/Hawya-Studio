# ADR-003 — Brand model is the source of truth

**Status:** Accepted

Pages may reference brand tokens/assets/rules. They must not copy global values by default.

A page is composed from:

```text
Semantic PageContent + TemplateBinding + Local Extras/Overrides
```

Changing a global color/font/logo therefore updates every referenced rendering. The user can intentionally detach a property into a local override, and the UI must show that state.

This enables template switching, machine-readable exports, audits, and future production outputs.
