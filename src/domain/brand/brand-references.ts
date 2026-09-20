import type { AssetId } from "@/domain/assets/asset";
import type { ColorToken, TextStyleToken } from "@/domain/brand/brand-system";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";

function countKeyValue(value: unknown, key: string, expected: string): number {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countKeyValue(item, key, expected), 0);
  }
  if (!value || typeof value !== "object") {
    return 0;
  }
  let count = 0;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && entryValue === expected) {
      count += 1;
    }
    count += countKeyValue(entryValue, key, expected);
  }
  return count;
}

export function countAssetReferences(snapshot: ProjectSnapshot, assetId: AssetId): number {
  return countKeyValue(snapshot.project, "assetId", assetId);
}

export function countColorTokenReferences(snapshot: ProjectSnapshot, tokenId: string): number {
  return (
    countKeyValue(snapshot.project, "colorTokenId", tokenId) +
    countKeyValue(snapshot.project, "preferredBackground", tokenId)
  );
}

export function resolveColorToken(
  tokens: readonly ColorToken[],
  tokenId: string | undefined,
): ColorToken | undefined {
  return tokenId ? tokens.find((token) => token.id === tokenId) : undefined;
}

export function resolveTextStyleColor(
  style: TextStyleToken,
  tokens: readonly ColorToken[],
): string | undefined {
  return resolveColorToken(tokens, style.colorTokenId)?.srgbHex;
}
