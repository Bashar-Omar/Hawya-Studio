import type { ColorToken } from "@/domain/brand/brand-system";

export interface ContrastPair {
  foregroundId: string;
  backgroundId: string;
}

const ROLE_PRIORITY: Record<ColorToken["role"], number> = {
  primary: 0,
  accent: 1,
  semantic: 2,
  secondary: 3,
  supporting: 4,
  neutral: 5,
  custom: 6,
};

function pairScore(foreground: ColorToken, background: ColorToken): number {
  const neutralBonus = foreground.role === "neutral" || background.role === "neutral" ? -20 : 0;
  return neutralBonus + ROLE_PRIORITY[foreground.role] * 7 + ROLE_PRIORITY[background.role];
}

export function selectMeaningfulContrastPairs(
  tokens: readonly ColorToken[],
  maxPairs = 24,
): ContrastPair[] {
  const candidates: Array<{ pair: ContrastPair; score: number; key: string }> = [];
  for (let first = 0; first < tokens.length; first += 1) {
    for (let second = first + 1; second < tokens.length; second += 1) {
      const a = tokens[first];
      const b = tokens[second];
      if (!a || !b) continue;
      const foreground = ROLE_PRIORITY[a.role] <= ROLE_PRIORITY[b.role] ? a : b;
      const background = foreground.id === a.id ? b : a;
      candidates.push({
        pair: { foregroundId: foreground.id, backgroundId: background.id },
        score: pairScore(foreground, background),
        key: `${foreground.id}:${background.id}`,
      });
    }
  }
  return candidates
    .sort((a, b) => a.score - b.score || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, maxPairs))
    .map((candidate) => candidate.pair);
}
