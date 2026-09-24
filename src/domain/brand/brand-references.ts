import type { AssetId } from "@/domain/assets/asset";
import type { ColorToken, TextStyleToken } from "@/domain/brand/brand-system";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";

const ASSET_REFERENCE_KEYS = new Set(["assetId", "backgroundAssetId"]);
const COLOR_REFERENCE_KEYS = new Set(["colorTokenId", "preferredBackground"]);

function countStringReferences(
  value: unknown,
  keys: ReadonlySet<string>,
  counts = new Map<string, number>(),
): Map<string, number> {
  if (Array.isArray(value)) {
    for (const item of value) countStringReferences(item, keys, counts);
    return counts;
  }
  if (!value || typeof value !== "object") {
    return counts;
  }
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (keys.has(entryKey) && typeof entryValue === "string") {
      counts.set(entryValue, (counts.get(entryValue) ?? 0) + 1);
    }
    countStringReferences(entryValue, keys, counts);
  }
  return counts;
}

export function countAssetReferencesById(snapshot: ProjectSnapshot): ReadonlyMap<AssetId, number> {
  return countStringReferences(snapshot.project, ASSET_REFERENCE_KEYS) as ReadonlyMap<
    AssetId,
    number
  >;
}

export function countColorTokenReferencesById(
  snapshot: ProjectSnapshot,
): ReadonlyMap<string, number> {
  return countStringReferences(snapshot.project, COLOR_REFERENCE_KEYS);
}

export function countAssetReferences(snapshot: ProjectSnapshot, assetId: AssetId): number {
  return countAssetReferencesById(snapshot).get(assetId) ?? 0;
}

export function countColorTokenReferences(snapshot: ProjectSnapshot, tokenId: string): number {
  return countColorTokenReferencesById(snapshot).get(tokenId) ?? 0;
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
