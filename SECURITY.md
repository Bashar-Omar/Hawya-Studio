# Security Policy

Hawya Studio is a local-first design tool that will process untrusted files in the browser. Security reports are welcome and should be treated seriously even when no server is involved.

## Supported version

During pre-1.0 development, security fixes target the latest `main` branch and the latest published release when one exists.

## Reporting a vulnerability

Please use **GitHub Private Vulnerability Reporting / Security Advisories** for this repository when available. Do not open a public issue containing an exploitable payload or private user data.

Include:

- affected commit/release;
- browser/OS when relevant;
- minimal reproduction steps;
- impact;
- proof-of-concept file only when safe to share privately.

## High-risk surfaces

Give extra scrutiny to changes involving:

- malicious or oversized SVG/XML input;
- path traversal, zip bombs, duplicate paths, and archive decompression limits in `.hawya`/ZIP import;
- font parsing and binary metadata extraction;
- project schema injection or unvalidated migrations;
- browser File System Access handles;
- IndexedDB binary persistence;
- service-worker caching/update behavior;
- HTML/Markdown/static-web export escaping;
- object URLs and lifetime/revocation;
- worker message validation;
- any code path that could execute user-provided script.

## Core security invariants

- Untrusted external content is data, never executable code.
- SVG imports must be sanitized before rendering or export reuse.
- Archive paths and sizes must be validated before extraction.
- Runtime schema validation is required at trust boundaries once schema infrastructure lands.
- Hawya core must not require secrets, analytics trackers, remote execution, or paid hosted processing.

See the Project Pack security specifications before implementing file ingestion/export behavior.
