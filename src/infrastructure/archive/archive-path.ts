import { ProjectArchiveError } from "@/domain/project/errors";

const DRIVE_PREFIX = /^[A-Za-z]:\//;

export function normalizeArchivePath(input: string): string {
  if (input.includes("\0")) {
    throw new ProjectArchiveError("unsafe-path", "Archive entry contains a NUL byte");
  }

  const normalized = input.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || DRIVE_PREFIX.test(normalized)) {
    throw new ProjectArchiveError(
      "unsafe-path",
      `Archive entry has an unsafe absolute path: ${input}`,
    );
  }
  if (normalized.length > 1024) {
    throw new ProjectArchiveError("unsafe-path", "Archive entry path is unreasonably long");
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === ".." || segment === "." || segment === "")) {
    throw new ProjectArchiveError(
      "unsafe-path",
      `Archive entry has unsafe path components: ${input}`,
    );
  }

  return normalized;
}

export function isIgnorableOsMetadataPath(path: string): boolean {
  return path.startsWith("__MACOSX/") || path.endsWith("/.DS_Store") || path === ".DS_Store";
}
