# Coding Standards

## TypeScript
- `strict: true`;
- no `any` except isolated third-party boundary with comment and narrowing immediately after;
- prefer discriminated unions to boolean soups;
- no non-null assertion unless invariant is proven and documented;
- use `satisfies` for config/static data;
- all imported external JSON parsed as `unknown` then validated;
- exhaustive switch helper for unions.

## Functions
- pure domain functions preferred;
- side effects live in adapters/use cases;
- one responsibility per function/module;
- dependency injection through small interfaces, not global service locators;
- never pass huge “context” objects containing unrelated services.

## React
- components render state; they do not become business-service classes;
- hooks wrap feature/application behavior, not domain rules;
- avoid effect-driven state derivation when value can be derived during render/selectors;
- no network/storage calls directly in presentation components;
- memoization only where profiling/identity constraints warrant it;
- controlled editor components should avoid rerendering whole canvas for pointer frames.

## CSS
- interface uses logical properties for RTL;
- no page-artwork dimensions hardcoded in global CSS;
- theme colors via semantic CSS variables;
- arbitrary Tailwind values allowed only when they represent local geometric constants; repeated values graduate to tokens.

## Comments
Explain **why**, invariants and non-obvious browser quirks. Do not narrate obvious code.

## Formatting/lint
One formatter, one lint path in CI. Do not combine multiple auto-formatters fighting each other.
