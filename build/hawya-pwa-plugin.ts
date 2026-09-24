import { createHash } from "node:crypto";

import type { Plugin } from "vite";

const PUBLIC_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/hawya-192.png",
  "/icons/hawya-512.png",
] as const;

const PRECACHE_EXTENSIONS = /\.(?:css|js|png|jpe?g|svg|webp|woff2?|ttf|otf)$/i;

function serviceWorkerSource(shellAssets: readonly string[], version: string): string {
  return `const CACHE_PREFIX = "hawya-shell-";\nconst CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};\nconst APP_SHELL = ${JSON.stringify(shellAssets)};\n\nself.addEventListener("install", (event) => {\n  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));\n});\n\nself.addEventListener("activate", (event) => {\n  event.waitUntil(\n    caches\n      .keys()\n      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))\n      .then(() => self.clients.claim()),\n  );\n});\n\nself.addEventListener("fetch", (event) => {\n  const { request } = event;\n  if (request.method !== "GET") return;\n\n  const url = new URL(request.url);\n  if (url.origin !== self.location.origin) return;\n\n  if (request.mode === "navigate") {\n    event.respondWith(\n      caches.match("/index.html").then((cached) => cached ?? fetch(request)),\n    );\n    return;\n  }\n\n  if (!APP_SHELL.includes(url.pathname)) return;\n  event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached ?? fetch(request)));\n});\n`;
}

export function hawyaPwaPlugin(): Plugin {
  return {
    name: "hawya-pwa",
    apply: "build",
    generateBundle(_options, bundle) {
      const emittedAssets = Object.values(bundle)
        .map((output) => `/${output.fileName}`)
        .filter((fileName) => PRECACHE_EXTENSIONS.test(fileName));
      const shellAssets = [...new Set([...PUBLIC_SHELL_ASSETS, ...emittedAssets])].sort();
      const version = createHash("sha256")
        .update(shellAssets.join("\n"))
        .digest("hex")
        .slice(0, 16);

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: serviceWorkerSource(shellAssets, version),
      });
    },
  };
}
