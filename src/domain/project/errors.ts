export type StorageErrorCode =
  | "database-unavailable"
  | "transaction-failed"
  | "corrupt-persisted-data";

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  override readonly cause?: unknown;

  constructor(code: StorageErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    this.cause = cause;
  }
}

export type ProjectArchiveErrorCode =
  | "invalid-signature"
  | "archive-too-large"
  | "too-many-entries"
  | "entry-too-large"
  | "unsafe-path"
  | "duplicate-entry"
  | "missing-critical-entry"
  | "invalid-manifest"
  | "unsupported-format-version"
  | "unsupported-reader-version"
  | "invalid-project"
  | "checksum-mismatch"
  | "missing-binary"
  | "invalid-binary-path"
  | "decompression-failed";

export class ProjectArchiveError extends Error {
  readonly code: ProjectArchiveErrorCode;
  override readonly cause?: unknown;

  constructor(code: ProjectArchiveErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ProjectArchiveError";
    this.code = code;
    this.cause = cause;
  }
}

export class MigrationError extends Error {
  readonly sourceVersion: number;
  readonly targetVersion: number;

  constructor(message: string, sourceVersion: number, targetVersion: number) {
    super(message);
    this.name = "MigrationError";
    this.sourceVersion = sourceVersion;
    this.targetVersion = targetVersion;
  }
}
