import type { FontAssetRef } from "@/domain/brand/brand-system";

export interface FontRegistry {
  register(font: FontAssetRef, bytes: Uint8Array): Promise<string>;
  familyName(font: FontAssetRef): string;
  unregister(fontRefId: string): void;
}
