# Stage 01 Dependency Review

Stage 01 adds only dependencies required by the binding UI baseline. No SaaS, account, network runtime or paid service is introduced.

## `@base-ui/react` 1.8.0

**Problem solved:** accessible low-level interaction primitives for dialogs and direction-aware UI behavior under the shadcn/Base UI baseline.

**Why native/current dependencies are insufficient:** native `<dialog>` is viable for simple cases, but the Project Pack explicitly selects current shadcn source-owned components with Base UI primitives. Base UI provides focus management, inert modal behavior, return-focus handling and a direction provider without adding application styling ownership.

**License / maintenance:** MIT. Actively maintained as the current Base UI line.

**Runtime:** yes. Imports are component-level and tree-shakeable.

**Bundle strategy:** only Dialog and DirectionProvider are used in Stage 01. No broad wildcard component import.

**Exit strategy:** UI wrappers live under `components/ui`; replacing Base UI does not change feature or domain APIs.

## `lucide-react` 1.47.0

**Problem solved:** one consistent open-source icon family, as required by the visual design system.

**Why native/current dependencies are insufficient:** hand-maintaining SVG path data would duplicate an established library and make consistency/accessibility review harder.

**License / maintenance:** ISC, zero package dependencies, actively maintained.

**Runtime:** yes.

**Bundle strategy:** named ESM icon imports only; unused icons are tree-shaken.

**Exit strategy:** icons are presentational and isolated in UI components/features.

## `@fontsource-variable/inter` 5.3.0

**Problem solved:** self-hosted Latin UI typography without a runtime font CDN.

**Why native/current dependencies are insufficient:** system font metrics vary by operating system; the design system calls for a stable open-license Latin UI face.

**License / maintenance:** SIL Open Font License 1.1. The package has no runtime dependencies.

**Runtime:** build-time asset dependency; Vite emits same-origin WOFF2 assets.

**Bundle strategy:** variable `wght.css` only; browsers load needed unicode ranges.

**Exit strategy:** CSS keeps a complete system fallback stack.

## `@fontsource-variable/noto-sans-arabic` 5.3.0

**Problem solved:** self-hosted Arabic UI typography with strong Arabic coverage and no external CDN.

**Why native/current dependencies are insufficient:** Arabic system fonts vary significantly across target OSes; typography is structural to RTL usability.

**License / maintenance:** SIL Open Font License 1.1. The package has no runtime dependencies.

**Runtime:** build-time asset dependency; Vite emits same-origin WOFF2 assets.

**Bundle strategy:** variable `wght.css`; Fontsource unicode-range CSS prevents unrelated subsets from loading unnecessarily.

**Exit strategy:** CSS retains Arabic/system fallbacks and the font package is not part of domain data.

## License notice

The two Fontsource packages distribute their font files under OFL-1.1 and include the upstream licensing metadata in the locked package artifacts. Hawya does not redistribute font binaries in its source handoff ZIP or Git repository; production builds emit them from the installed, version-locked packages.
