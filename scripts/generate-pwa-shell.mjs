import { createHash } from "node:crypto";
import { readdir, writeFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const DIST_DIR = resolve("dist");
const SERVICE_WORKER_PATH = resolve(DIST_DIR, "sw.js");
const PRECACHE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function webPath(absolutePath) {
  return `/${relative(DIST_DIR, absolutePath).split(sep).join("/")}`;
}

const buildFiles = (await walk(DIST_DIR))
  .filter((path) => PRECACHE_EXTENSIONS.has(extname(path).toLowerCase()))
  .map(webPath);
const shellAssets = ["/", "/index.html", "/manifest.webmanifest", ...buildFiles]
  .filter((value, index, values) => values.indexOf(value) === index)
  .sort();
const version = createHash("sha256").update(shellAssets.join("\n")).digest("hex").slice(0, 16);

const source = `const CACHE_PREFIX = "hawya-shell-";
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const APP_SHELL = ${JSON.stringify(shellAssets)};
const APP_SHELL_PATHS = new Set(APP_SHELL);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(caches.match("/index.html").then((cached) => cached ?? fetch(request)));
    return;
  }

  if (!APP_SHELL_PATHS.has(url.pathname)) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached ?? fetch(request)),
  );
});
`;

await writeFile(SERVICE_WORKER_PATH, source, "utf8");
console.log(`Generated ${webPath(SERVICE_WORKER_PATH)} with ${shellAssets.length} offline assets.`);
