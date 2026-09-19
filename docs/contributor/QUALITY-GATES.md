# Engineering Quality Gates

No stage is “done” because it looks correct once.

Every merge to `main` must pass:
- install from lockfile;
- typecheck;
- lint;
- unit tests;
- critical component tests;
- production build;
- selected Playwright smoke tests;
- no newly introduced high/critical known dependency issue without documented exception;
- no committed secrets;
- no paid service requirement.

Additional gates by feature:
- domain/schema change → migration/fixture tests;
- editor transform change → geometry tests + E2E;
- RTL change → RTL tests;
- export change → golden fixtures;
- import/parser change → malformed/adversarial fixtures;
- performance-sensitive change → benchmark/profile evidence when regression risk is real.

A coding agent must state which checks it ran and their results before considering a task finished.
