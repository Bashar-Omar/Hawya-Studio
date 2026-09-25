import { readFile } from "node:fs/promises";

const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

const requiredHeaderDirectives = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "child-src 'self'",
  "manifest-src 'self'",
  "media-src 'self' blob:",
];

const globalHeaders = vercel.headers?.find((rule) => rule.source === "/(.*)")?.headers ?? [];
const cspHeader = globalHeaders.find((header) => header.key === "Content-Security-Policy")?.value;
if (!cspHeader) throw new Error("Production Content-Security-Policy header is missing.");

for (const directive of requiredHeaderDirectives) {
  if (
    !cspHeader
      .split(";")
      .map((value) => value.trim())
      .includes(directive)
  ) {
    throw new Error(`Production CSP is missing directive: ${directive}`);
  }
}
if (/\*|unsafe-eval/.test(cspHeader)) {
  throw new Error("Production CSP must not contain wildcard sources or unsafe-eval.");
}
if (vercel.git?.deploymentEnabled !== false) {
  throw new Error("Vercel Git deployments must remain disabled during staged QA.");
}

const requiredSecurityHeaders = new Map([
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
]);
for (const [key, value] of requiredSecurityHeaders) {
  const actual = globalHeaders.find((header) => header.key === key)?.value;
  if (actual !== value) throw new Error(`Missing or invalid ${key} header.`);
}

const meta = html.match(
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/>/s,
)?.[1];
if (!meta) throw new Error("Static-host CSP meta fallback is missing.");

const metaDirectives = cspHeader
  .split(";")
  .map((value) => value.trim())
  .filter((value) => value && !value.startsWith("frame-ancestors"));
for (const directive of metaDirectives) {
  if (
    !meta
      .split(";")
      .map((value) => value.trim())
      .includes(directive)
  ) {
    throw new Error(`CSP meta fallback is missing directive: ${directive}`);
  }
}
if (/unsafe-eval|frame-ancestors|\*/.test(meta)) {
  throw new Error("CSP meta fallback contains a forbidden directive/source.");
}

const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
if (scripts.some((match) => !/\bsrc=/.test(match[1] ?? ""))) {
  throw new Error("index.html contains an inline script, which violates Stage 11 policy.");
}

console.log("Stage 11 security policy: CSP/header/static-host fallback checks passed.");
