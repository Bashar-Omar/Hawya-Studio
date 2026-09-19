# ADR-006 — Honest multi-format export

**Status:** Accepted

Guaranteed core outputs:
- `.hawya` portable project archive;
- editable SVG;
- outlined SVG for visual fidelity;
- PNG/JPEG;
- browser Print/PDF view;
- JSON/CSS tokens;
- `brand-guidelines.md`;
- static Web Guide bundle;
- delivery ZIP.

The project will not claim native `.ai` or `.indd` generation from browser data. A future Illustrator companion can implement a native bridge separately.

Print/PDF is RGB/browser-rendered unless future validated print tooling explicitly upgrades the contract. Never market it as PDF/X/press-ready CMYK without real implementation and testing.
