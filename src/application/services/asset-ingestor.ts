import type { AssetSanitizer } from "@/application/ports/asset-sanitizer";
import type { BinaryStore } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type { ContentHasher } from "@/application/ports/content-hasher";
import type { FontAnalyzer } from "@/application/ports/font-analyzer";
import type { RasterAnalyzer } from "@/application/ports/raster-analyzer";
import type { AssetKind, ContentHash } from "@/domain/assets/asset";
import {
  detectAssetFile,
  validateAssetSize,
  validateDeclaredAssetType,
} from "@/domain/assets/asset-policy";

export interface AssetSource {
  bytes: Uint8Array;
  filename: string;
  declaredMime: string;
  intendedKind?: Extract<AssetKind, "logo" | "vector" | "image" | "font">;
}

export interface PreparedAssetContent {
  contentHash: ContentHash;
  mime: string;
  extension: string;
  byteLength: number;
  detectedKind: Extract<AssetKind, "vector" | "image" | "font">;
  metadata: Record<string, unknown>;
  previewBinaryKey?: ContentHash;
  security: {
    sanitized?: boolean;
    rejectedFeatures?: string[];
  };
}

export class AssetIngestor {
  constructor(
    private readonly hasher: ContentHasher,
    private readonly binaries: BinaryStore,
    private readonly sanitizer: AssetSanitizer,
    private readonly fonts: FontAnalyzer,
    private readonly rasters: RasterAnalyzer,
    private readonly clock: Clock,
  ) {}

  async prepare(source: AssetSource): Promise<PreparedAssetContent> {
    validateAssetSize(source.bytes.byteLength);
    const detected = detectAssetFile(source.bytes);
    if (!detected) {
      throw new Error("Unsupported or unrecognized asset file");
    }
    validateDeclaredAssetType(detected, source.filename, source.declaredMime);
    if (source.intendedKind === "font" && detected.defaultKind !== "font") {
      throw new Error("Selected file is not a supported font");
    }
    if (source.intendedKind && source.intendedKind !== "font" && detected.defaultKind === "font") {
      throw new Error("Font files cannot be used as image/vector assets");
    }

    let bytes = source.bytes;
    let metadata: Record<string, unknown> = {
      detectedFormat: detected.format,
      ingestedAt: this.clock.now(),
    };
    let security: PreparedAssetContent["security"] = {};
    let previewBinaryKey: ContentHash | undefined;

    if (detected.format === "svg") {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
      const sanitized = await this.sanitizer.sanitizeSvg(decoded);
      bytes = new TextEncoder().encode(sanitized.svg);
      metadata = { ...metadata, ...sanitized.metadata };
      security = {
        sanitized: true,
        ...(sanitized.rejectedFeatures.length > 0
          ? { rejectedFeatures: sanitized.rejectedFeatures }
          : {}),
      };
    } else if (detected.defaultKind === "font") {
      metadata = { ...metadata, ...(await this.fonts.analyze(source.bytes)) };
    } else {
      const raster = await this.rasters.analyze(source.bytes, detected.mime);
      metadata = {
        ...metadata,
        width: raster.width,
        height: raster.height,
        hasAlpha: raster.hasAlpha,
        ...(raster.preview
          ? { preview: { width: raster.preview.width, height: raster.preview.height } }
          : {}),
      };
      if (raster.preview) {
        previewBinaryKey = await this.store(raster.preview.bytes, raster.preview.mime);
      }
    }

    const contentHash = await this.store(bytes, detected.mime);
    return {
      contentHash,
      mime: detected.mime,
      extension: detected.extension,
      byteLength: bytes.byteLength,
      detectedKind: detected.defaultKind,
      metadata,
      ...(previewBinaryKey ? { previewBinaryKey } : {}),
      security,
    };
  }

  private async store(bytes: Uint8Array, mime: string): Promise<ContentHash> {
    const contentHash = await this.hasher.hash(bytes);
    await this.binaries.put({ contentHash, mime, bytes });
    return contentHash;
  }
}
