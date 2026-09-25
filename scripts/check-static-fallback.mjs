import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const basePath = "/Hawya-Studio/";
const dist = resolve("dist");
const [html, manifestSource, serviceWorker] = await Promise.all([
  readFile(resolve(dist, "index.html"), "utf8"),
  readFile(resolve(dist, "manifest.webmanifest"), "utf8"),
  readFile(resolve(dist, "sw.js"), "utf8"),
]);
const manifest = JSON.parse(manifestSource);

for (const expected of [
  `${basePath}manifest.webmanifest`,
  `${basePath}icons/hawya-192.png`,
]) {
  if (!html.includes(expected)) throw new Error(`Static fallback HTML is missing ${expected}`);
}
if (!html.includes(`${basePath}assets/`)) {
  throw new Error("Static fallback HTML does not reference Vite assets under the repository base");
}
if (manifest.start_url !== basePath || manifest.scope !== basePath) {
  throw new Error(
    `Static fallback manifest has invalid start/scope: ${manifest.start_url} / ${manifest.scope}`,
  );
}
for (const icon of manifest.icons ?? []) {
  if (!icon.src?.startsWith(`${basePath}icons/`)) {
    throw new Error(`Static fallback manifest icon escapes repository base: ${icon.src}`);
  }
}
for (const expected of [
  `const BASE_PATH = ${JSON.stringify(basePath)}`,
  JSON.stringify(`${basePath}index.html`),
  JSON.stringify(`${basePath}manifest.webmanifest`),
]) {
  if (!serviceWorker.includes(expected)) {
    throw new Error(`Static fallback service worker is missing ${expected}`);
  }
}
if (/([#'])\/assets\//.test(html) || /([#'])\/icons\//.test(html)) {
  throw new Error("Static fallback HTML still contains root-relative built asset URLs");
}

console.log("Static fallback build gate passed for /Hawya-Studio/.");
