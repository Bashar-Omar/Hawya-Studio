import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const html = await readFile(join(root, "index.html"), "utf8");

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

async function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJavaScriptFiles(absolute)));
    else if (extname(entry.name) === ".js") files.push(absolute);
  }
  return files;
}

const builtJavaScript = await collectJavaScriptFiles(join(root, "dist"));
for (const file of builtJavaScript) {
  const source = await readFile(file, "utf8");
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) {
    throw new Error(
      `Production JavaScript contains dynamic code evaluation forbidden by Stage 11 policy: ${file}`,
    );
  }
}

console.log(
  `Stage 11 security policy: CSP/headers/static-host fallback and ${builtJavaScript.length} built JS files passed.`,
);
