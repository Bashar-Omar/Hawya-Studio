# Dependency and License Policy

Before adding any package, PR/agent documents:
1. exact problem it solves;
2. why native platform/current deps are insufficient;
3. license compatible with MIT project;
4. current maintenance/security posture;
5. runtime vs dev-only;
6. approximate bundle impact/lazy-load strategy;
7. exit strategy if package is abandoned.

## Preferred dependency traits
- MIT/Apache/BSD or clearly compatible;
- active maintenance;
- TypeScript support;
- browser-focused where runtime;
- tree-shakeable/lazy-loadable;
- no mandatory SaaS/account.

## Disallowed by default
- copyleft dependency whose obligations conflict with intended distribution unless reviewed explicitly;
- “free tier” SaaS required for a core feature;
- analytics SDKs;
- abandoned security-sensitive parsers;
- packages that execute remote code/content.

## Locking
Commit pnpm lockfile. Dependabot/Renovate-like updates may be used if free, but security updates never bypass tests.
