import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

const host = "127.0.0.1";
const port = 4174;
const basePath = "/Hawya-Studio/";
const dist = resolve("dist");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function safeRelativePath(pathname) {
  if (!pathname.startsWith(basePath)) return undefined;
  const relativePath = decodeURIComponent(pathname.slice(basePath.length));
  if (!relativePath || relativePath === "/") return "index.html";
  if (relativePath.includes("..") || relativePath.includes("\\")) return undefined;
  return relativePath.replace(/^\/+/, "");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const relativePath = safeRelativePath(url.pathname);
  if (!relativePath) {
    response.writeHead(404).end("Not found");
    return;
  }

  const absolutePath = resolve(dist, relativePath);
  const info = await stat(absolutePath).catch(() => undefined);
  if (!info?.isFile() || !absolutePath.startsWith(dist)) {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes.get(extname(absolutePath)) ?? "application/octet-stream",
  });
  createReadStream(absolutePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Static fallback server listening on http://${host}:${port}${basePath}`);
});
