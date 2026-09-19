/**
 * shadcn/ui's utility alias is reserved here from Stage 00.
 * The current shadcn CLI can own the concrete `cn` helper when the first
 * source-owned UI component lands in Stage 01, avoiding an unused runtime dependency now.
 */
export function joinClassNames(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}
