export interface ArchiveEntry {
  path: string;
  bytes: Uint8Array;
}

export interface ArchivePackager {
  pack(entries: readonly ArchiveEntry[], signal: AbortSignal): Promise<Uint8Array>;
}
