import type { FontRegistry } from "@/application/ports/font-registry";
import type { FontAssetRef } from "@/domain/brand/brand-system";

function safeFamilyName(font: FontAssetRef): string {
  return `Hawya_${font.id.replace(/-/g, "_")}`;
}

export class BrowserFontRegistry implements FontRegistry {
  private readonly registered = new Map<string, FontFace>();

  familyName(font: FontAssetRef): string {
    return safeFamilyName(font);
  }

  async register(font: FontAssetRef, bytes: Uint8Array): Promise<string> {
    const family = safeFamilyName(font);
    this.unregister(font.id);
    const source = Uint8Array.from(bytes).buffer;
    const face = new FontFace(family, source, {
      style: font.style ?? "normal",
      weight: font.weight ? String(font.weight) : "normal",
    });
    await face.load();
    document.fonts.add(face);
    this.registered.set(font.id, face);
    return family;
  }

  unregister(fontRefId: string): void {
    const existing = this.registered.get(fontRefId);
    if (!existing) return;
    document.fonts.delete(existing);
    this.registered.delete(fontRefId);
  }
}
