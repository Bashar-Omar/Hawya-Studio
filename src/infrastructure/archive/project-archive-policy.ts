export interface ProjectArchivePolicy {
  maxCompressedBytes: number;
  maxEntries: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
}

export const DEFAULT_PROJECT_ARCHIVE_POLICY: ProjectArchivePolicy = Object.freeze({
  maxCompressedBytes: 512 * 1024 * 1024,
  maxEntries: 10_000,
  maxEntryUncompressedBytes: 512 * 1024 * 1024,
  maxTotalUncompressedBytes: 2 * 1024 * 1024 * 1024,
});
