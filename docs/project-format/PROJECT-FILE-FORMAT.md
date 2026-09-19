# `.hawya` Project File Format

A `.hawya` file is a ZIP archive with a documented structure. Its openness is deliberate so users are not locked into Hawya.

## Structure

```text
my-brand.hawya
├── manifest.json
├── project.json
├── checksums.json
├── assets/
│   └── <sha256>.<safe-ext>
├── fonts/
│   └── <sha256>.<safe-ext>
├── previews/
│   └── cover.webp
└── README.txt  (optional human-readable recovery note)
```

## Manifest minimum

```json
{
  "format": "hawya-project",
  "formatVersion": 1,
  "appVersion": "x.y.z",
  "minReaderVersion": "x.y.z",
  "projectId": "uuid",
  "projectName": "...",
  "createdAt": "...",
  "exportedAt": "...",
  "hashAlgorithm": "SHA-256",
  "entry": "project.json"
}
```

## Import algorithm

1. inspect file signature/size, not extension only;
2. stream/decompress with safety limits;
3. manifest must exist at exact root path;
4. reject path traversal (`../`, absolute paths, NULs);
5. validate manifest with Zod;
6. enforce supported formatVersion/minReaderVersion;
7. validate entry count and total decompressed size;
8. verify checksums for every referenced binary;
9. parse and validate project JSON;
10. run migrations in memory;
11. re-sanitize SVG assets even if manifest claims sanitized;
12. analyze potentially risky fonts/images in worker;
13. write to IndexedDB in a transaction under a **new local project ID** by default;
14. if transaction fails, no partial project remains.

## Export algorithm

- snapshot project at one revision;
- gather only referenced binaries;
- derive deterministic safe filenames from hashes;
- produce checksums;
- include format metadata;
- use asynchronous/streaming ZIP where practical;
- normal download fallback always available;
- File System Access save picker is optional progressive enhancement.

## Forward compatibility

Unknown optional fields are preserved where feasible by migration serializer only if schema supports them safely. Unknown executable/template code is never executed.
