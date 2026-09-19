import { strFromU8, strToU8, unzip, zip } from "fflate";

import type { BinaryPayload } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type { ContentHasher } from "@/application/ports/content-hasher";
import type {
  ProjectArchiveBundle,
  ProjectArchiveCodec,
} from "@/application/ports/project-archive-codec";
import { contentHashSchema, type Asset, type ContentHash } from "@/domain/assets/asset";
import { ProjectArchiveError } from "@/domain/project/errors";
import { migrateProjectSnapshot } from "@/domain/project/migrations";
import { projectSnapshotSchema, type ProjectSnapshot } from "@/domain/project/hawya-project";
import { CURRENT_HAWYA_ARCHIVE_FORMAT_VERSION } from "@/domain/project/schema-version";
import { appMetadata } from "@/app/app-metadata";
import { err, ok, type Result } from "@/shared/types/result";
import {
  isIgnorableOsMetadataPath,
  normalizeArchivePath,
} from "@/infrastructure/archive/archive-path";
import { canonicalJson } from "@/infrastructure/archive/canonical-json";
import {
  archiveChecksumsSchema,
  hawyaArchiveManifestSchema,
} from "@/infrastructure/archive/project-archive-schema";
import {
  DEFAULT_PROJECT_ARCHIVE_POLICY,
  type ProjectArchivePolicy,
} from "@/infrastructure/archive/project-archive-policy";

const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_EMPTY_ARCHIVE_SIGNATURE = 0x06054b50;
const ZIP_EPOCH = new Date("1980-01-01T00:00:00.000Z");
const BINARY_ENTRY_PATTERN = /^(assets|fonts)\/([a-f0-9]{64})\.([a-z0-9]+)$/;

function asArchiveError(error: unknown, fallback: ProjectArchiveError): ProjectArchiveError {
  return error instanceof ProjectArchiveError ? error : fallback;
}

function parseJson(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch (error) {
    throw new ProjectArchiveError("invalid-project", `${label} is not valid JSON`, error);
  }
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function hasZipSignature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 4) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0, true);
  return signature === ZIP_LOCAL_FILE_SIGNATURE || signature === ZIP_EMPTY_ARCHIVE_SIGNATURE;
}

function binaryArchivePath(assets: readonly Asset[]): string {
  const sorted = [...assets].sort((left, right) => {
    const leftFont = left.kind === "font" ? 0 : 1;
    const rightFont = right.kind === "font" ? 0 : 1;
    return leftFont - rightFont || left.id.localeCompare(right.id);
  });
  const representative = sorted[0];
  if (!representative) {
    throw new ProjectArchiveError("missing-binary", "A referenced binary has no asset metadata");
  }
  const directory = representative.kind === "font" ? "fonts" : "assets";
  const extension = representative.extension ?? "bin";
  return `${directory}/${representative.contentHash}.${extension}`;
}

function zipAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 6, mtime: ZIP_EPOCH }, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
}

interface UnzipResult {
  entries: Map<string, Uint8Array>;
}

function unzipWithPolicy(bytes: Uint8Array, policy: ProjectArchivePolicy): Promise<UnzipResult> {
  if (bytes.byteLength > policy.maxCompressedBytes) {
    throw new ProjectArchiveError(
      "archive-too-large",
      `Compressed archive exceeds ${policy.maxCompressedBytes} bytes`,
    );
  }
  if (!hasZipSignature(bytes)) {
    throw new ProjectArchiveError("invalid-signature", "File does not have a ZIP signature");
  }

  return new Promise((resolve, reject) => {
    const seen = new Set<string>();
    let count = 0;
    let totalUncompressed = 0;
    let policyError: ProjectArchiveError | undefined;

    unzip(
      bytes,
      {
        filter(file) {
          if (policyError) {
            return false;
          }
          try {
            const path = normalizeArchivePath(file.name);
            if (isIgnorableOsMetadataPath(path)) {
              return false;
            }
            if (seen.has(path)) {
              throw new ProjectArchiveError(
                "duplicate-entry",
                `Archive contains duplicate entry ${path}`,
              );
            }
            seen.add(path);
            count += 1;
            if (count > policy.maxEntries) {
              throw new ProjectArchiveError(
                "too-many-entries",
                `Archive contains more than ${policy.maxEntries} entries`,
              );
            }
            if (file.originalSize > policy.maxEntryUncompressedBytes) {
              throw new ProjectArchiveError(
                "entry-too-large",
                `Archive entry ${path} exceeds the per-entry safety limit`,
              );
            }
            totalUncompressed += file.originalSize;
            if (totalUncompressed > policy.maxTotalUncompressedBytes) {
              throw new ProjectArchiveError(
                "archive-too-large",
                "Archive exceeds the cumulative uncompressed safety limit",
              );
            }
            return true;
          } catch (error) {
            policyError = asArchiveError(
              error,
              new ProjectArchiveError("decompression-failed", "Archive preflight failed", error),
            );
            return false;
          }
        },
      },
      (error, unzipped) => {
        if (policyError) {
          reject(policyError);
          return;
        }
        if (error) {
          reject(
            new ProjectArchiveError(
              "decompression-failed",
              "Archive could not be decompressed",
              error,
            ),
          );
          return;
        }

        try {
          const entries = new Map<string, Uint8Array>();
          for (const [rawPath, data] of Object.entries(unzipped)) {
            const path = normalizeArchivePath(rawPath);
            if (!isIgnorableOsMetadataPath(path)) {
              entries.set(path, data);
            }
          }
          resolve({ entries });
        } catch (normalizationError) {
          reject(
            asArchiveError(
              normalizationError,
              new ProjectArchiveError(
                "decompression-failed",
                "Archive entry names could not be normalized",
                normalizationError,
              ),
            ),
          );
        }
      },
    );
  });
}

export class FflateProjectArchiveCodec implements ProjectArchiveCodec {
  constructor(
    private readonly hasher: ContentHasher,
    private readonly clock: Clock,
    private readonly policy: ProjectArchivePolicy = DEFAULT_PROJECT_ARCHIVE_POLICY,
  ) {}

  async encode(bundle: ProjectArchiveBundle): Promise<Result<Uint8Array, ProjectArchiveError>> {
    try {
      const snapshot = projectSnapshotSchema.parse(bundle.snapshot);
      const referencedIds = new Set(
        snapshot.project.assetRefs.map((reference) => reference.assetId),
      );
      const referencedAssets = snapshot.assets.filter((asset) => referencedIds.has(asset.id));
      const assetsByHash = new Map<ContentHash, Asset[]>();
      for (const asset of referencedAssets) {
        const group = assetsByHash.get(asset.contentHash) ?? [];
        group.push(asset);
        assetsByHash.set(asset.contentHash, group);
      }

      const binaries = new Map(bundle.binaries.map((binary) => [binary.contentHash, binary]));
      const projectBytes = strToU8(canonicalJson(snapshot));
      const files: Record<string, Uint8Array> = { "project.json": projectBytes };
      const checksumEntries: Record<string, string> = {
        "project.json": await this.hasher.hash(projectBytes),
      };

      for (const [contentHash, assets] of [...assetsByHash.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      )) {
        const binary = binaries.get(contentHash);
        if (!binary) {
          throw new ProjectArchiveError(
            "missing-binary",
            `Project references binary ${contentHash} but no bytes were supplied`,
          );
        }
        const actualHash = await this.hasher.hash(binary.bytes);
        if (actualHash !== contentHash) {
          throw new ProjectArchiveError(
            "checksum-mismatch",
            `Binary payload does not match declared hash ${contentHash}`,
          );
        }
        if (assets.some((asset) => asset.byteLength !== binary.bytes.byteLength)) {
          throw new ProjectArchiveError(
            "checksum-mismatch",
            `Asset metadata byte length disagrees with binary ${contentHash}`,
          );
        }

        const path = binaryArchivePath(assets);
        files[path] = binary.bytes;
        checksumEntries[path] = actualHash;
      }

      const exportedAt = this.clock.now();
      const manifest = hawyaArchiveManifestSchema.parse({
        format: "hawya-project",
        formatVersion: CURRENT_HAWYA_ARCHIVE_FORMAT_VERSION,
        appVersion: appMetadata.version,
        minReaderVersion: appMetadata.version,
        projectId: snapshot.project.id,
        projectName: snapshot.project.metadata.name,
        createdAt: snapshot.project.metadata.createdAt,
        exportedAt,
        hashAlgorithm: "SHA-256",
        entry: "project.json",
      });
      const checksums = archiveChecksumsSchema.parse({
        algorithm: "SHA-256",
        entries: checksumEntries,
      });

      files["manifest.json"] = strToU8(canonicalJson(manifest));
      files["checksums.json"] = strToU8(canonicalJson(checksums));
      files["README.txt"] = strToU8(
        `Hawya Studio project archive\nProject: ${snapshot.project.metadata.name}\nSchema: ${snapshot.project.schemaVersion}\nExported: ${exportedAt}\n`,
      );

      return ok(await zipAsync(files));
    } catch (error) {
      return err(
        asArchiveError(
          error,
          new ProjectArchiveError("invalid-project", "Project archive could not be created", error),
        ),
      );
    }
  }

  async decode(bytes: Uint8Array): Promise<Result<ProjectArchiveBundle, ProjectArchiveError>> {
    try {
      const { entries } = await unzipWithPolicy(bytes, this.policy);
      const manifestBytes = entries.get("manifest.json");
      const projectBytes = entries.get("project.json");
      const checksumsBytes = entries.get("checksums.json");
      if (!manifestBytes || !projectBytes || !checksumsBytes) {
        throw new ProjectArchiveError(
          "missing-critical-entry",
          "Archive must contain manifest.json, project.json and checksums.json at the root",
        );
      }

      const manifestResult = hawyaArchiveManifestSchema.safeParse(
        parseJson(manifestBytes, "manifest.json"),
      );
      if (!manifestResult.success) {
        throw new ProjectArchiveError(
          "invalid-manifest",
          "manifest.json failed validation",
          manifestResult.error,
        );
      }
      const manifest = manifestResult.data;
      if (manifest.formatVersion !== CURRENT_HAWYA_ARCHIVE_FORMAT_VERSION) {
        throw new ProjectArchiveError(
          "unsupported-format-version",
          `Archive format ${manifest.formatVersion} is not supported`,
        );
      }
      if (compareSemver(manifest.minReaderVersion, appMetadata.version) > 0) {
        throw new ProjectArchiveError(
          "unsupported-reader-version",
          `Archive requires Hawya ${manifest.minReaderVersion} or newer`,
        );
      }

      const checksumsResult = archiveChecksumsSchema.safeParse(
        parseJson(checksumsBytes, "checksums.json"),
      );
      if (!checksumsResult.success) {
        throw new ProjectArchiveError(
          "checksum-mismatch",
          "checksums.json failed validation",
          checksumsResult.error,
        );
      }
      const checksums = checksumsResult.data;
      for (const [rawPath, expectedHash] of Object.entries(checksums.entries)) {
        const path = normalizeArchivePath(rawPath);
        const entry = entries.get(path);
        if (!entry) {
          throw new ProjectArchiveError(
            "checksum-mismatch",
            `Checksummed entry ${path} is missing`,
          );
        }
        const actualHash = await this.hasher.hash(entry);
        if (actualHash !== expectedHash) {
          throw new ProjectArchiveError("checksum-mismatch", `Checksum mismatch for ${path}`);
        }
      }

      const projectChecksum = checksums.entries[manifest.entry];
      if (!projectChecksum) {
        throw new ProjectArchiveError("checksum-mismatch", "project.json has no checksum entry");
      }

      let snapshot: ProjectSnapshot;
      try {
        snapshot = migrateProjectSnapshot(parseJson(projectBytes, "project.json"));
      } catch (error) {
        throw new ProjectArchiveError(
          "invalid-project",
          "project.json failed schema migration or validation",
          error,
        );
      }
      if (
        manifest.projectId !== snapshot.project.id ||
        manifest.projectName !== snapshot.project.metadata.name
      ) {
        throw new ProjectArchiveError(
          "invalid-manifest",
          "Manifest project identity does not match project.json",
        );
      }

      const binaryEntries = new Map<ContentHash, { path: string; bytes: Uint8Array }>();
      for (const [path, data] of entries) {
        if (!path.startsWith("assets/") && !path.startsWith("fonts/")) {
          continue;
        }
        const match = BINARY_ENTRY_PATTERN.exec(path);
        if (!match) {
          throw new ProjectArchiveError(
            "invalid-binary-path",
            `Invalid binary archive path ${path}`,
          );
        }
        const hash = contentHashSchema.parse(match[2]);
        if (binaryEntries.has(hash)) {
          throw new ProjectArchiveError(
            "duplicate-entry",
            `Binary hash ${hash} appears more than once`,
          );
        }
        binaryEntries.set(hash, { path, bytes: data });
      }

      const referencedIds = new Set(
        snapshot.project.assetRefs.map((reference) => reference.assetId),
      );
      const referencedAssets = snapshot.assets.filter((asset) => referencedIds.has(asset.id));
      const assetsByHash = new Map<ContentHash, Asset[]>();
      for (const asset of referencedAssets) {
        const group = assetsByHash.get(asset.contentHash) ?? [];
        group.push(asset);
        assetsByHash.set(asset.contentHash, group);
      }

      const binaries: BinaryPayload[] = [];
      for (const [contentHash, assets] of assetsByHash) {
        const entry = binaryEntries.get(contentHash);
        if (!entry) {
          throw new ProjectArchiveError(
            "missing-binary",
            `Referenced binary ${contentHash} is missing`,
          );
        }
        if (!checksums.entries[entry.path]) {
          throw new ProjectArchiveError(
            "checksum-mismatch",
            `Binary ${entry.path} is not checksummed`,
          );
        }
        const actualHash = await this.hasher.hash(entry.bytes);
        if (actualHash !== contentHash) {
          throw new ProjectArchiveError(
            "checksum-mismatch",
            `Binary filename/content mismatch for ${entry.path}`,
          );
        }
        if (assets.some((asset) => asset.byteLength !== entry.bytes.byteLength)) {
          throw new ProjectArchiveError(
            "checksum-mismatch",
            `Asset metadata byte length disagrees with ${entry.path}`,
          );
        }
        binaries.push({
          contentHash,
          mime: assets[0]?.mime ?? "application/octet-stream",
          bytes: entry.bytes,
        });
      }

      return ok({ snapshot, binaries });
    } catch (error) {
      return err(
        asArchiveError(
          error,
          new ProjectArchiveError(
            "decompression-failed",
            "Project archive could not be opened",
            error,
          ),
        ),
      );
    }
  }
}
