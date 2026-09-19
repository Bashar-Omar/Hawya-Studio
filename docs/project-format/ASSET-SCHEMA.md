# Asset Schema and Binary Model

## Asset entity

```ts
type Asset = {
 id: AssetId;
 projectId: ProjectId;
 contentHash: string; // SHA-256 lowercase hex
 kind: 'logo'|'image'|'vector'|'font'|'mockup'|'icon'|'illustration'|'document'|'attachment';
 name: string;
 originalFilename: string;
 mime: string;
 extension?: string;
 byteLength: number;
 createdAt: ISODateTime;
 updatedAt: ISODateTime;
 tags: string[];
 metadata: AssetMetadata;
 binaryKey: string; // normally contentHash
 previewBinaryKey?: string;
 security: {
   sanitized?: boolean;
   rejectedFeatures?: string[];
 };
};
```

## Content-addressed binaries

`binaryKey` points to a deduplicated Blob store keyed by SHA-256. Two projects may reference the same hash locally without duplicating bytes. Project export still includes only assets referenced by that project.

## Metadata by type

### Raster
width, height, alpha presence when cheaply available, color profile hint when available, orientation, generated thumbnail dimensions.

### SVG/vector
viewBox, measured visible bounds, width/height attributes, sanitized canonical SVG, detected colors, external-reference status.

### Font
family/subfamily/PostScript name, file format, weight/style, variable axes, Unicode/script coverage summary, embedding/license note entered by user.

### PDF/reference document
page count/preview may be generated lazily via PDF.js. PDF remains an opaque attachment; Hawya does not edit its internal objects in v1.

## Limits

Use warnings rather than arbitrary tiny caps because storage is local. Suggested defaults:
- warn at >25 MB single asset;
- require explicit confirmation at >100 MB;
- reject or stream carefully above implementation-defined hard safety limit based on browser capability;
- import archive checks both compressed and decompressed totals to resist ZIP bombs.

The actual numerical hard limit must be centralized in `AssetPolicy`, not repeated in UI components.
