# Stage 10 — Accessibility and Motion Pass

The application chrome continues to target WCAG 2.2 AA where practical.

Stage 10 verifies and hardens these existing behaviors:

- keyboard command menu access survives the lazy Studio route boundary;
- dialogs return focus to their trigger;
- editor layer deletion moves focus predictably to an adjacent layer;
- UI language switching updates `lang` and `dir` without moving physical canvas coordinates;
- the landing skip link is the first keyboard stop and moves focus to `main`;
- `prefers-reduced-motion: reduce` removes non-essential chrome transitions and dialog animations;
- touch input enlarges compact chrome controls to a 44 px minimum target where feasible;
- narrow EN/AR layouts remain free of horizontal overflow.

No user brand artwork is altered to force contrast compliance. Hawya's application chrome is the accessibility target; brand-content contrast remains a diagnostic concern.
