import { gzipSync } from "node:zlib";

import type { Plugin } from "vite";

const HEAVY_STARTUP_MODULE_MARKERS = [
  "@cantoo/fontkit",
  "/fflate/",
  "/dompurify/",
  "/colorjs.io/",
  "/react-moveable/",
] as const;

function byteLength(source: string): number {
  return Buffer.byteLength(source, "utf8");
}

export function hawyaBuildMetricsPlugin(): Plugin {
  return {
    name: "hawya-build-metrics",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((entry) => entry.type === "chunk");
      const appEntry =
        chunks.find(
          (chunk) =>
            chunk.isEntry &&
            chunk.facadeModuleId?.replaceAll("\\", "/").endsWith("/src/main.tsx"),
        ) ?? chunks.find((chunk) => chunk.isEntry);

      if (!appEntry) {
        throw new Error("Hawya build metrics could not locate the application entry chunk.");
      }

      const initialFiles = new Set<string>();
      const pending = [appEntry.fileName];
      while (pending.length > 0) {
        const fileName = pending.pop();
        if (!fileName || initialFiles.has(fileName)) continue;
        const output = bundle[fileName];
        if (!output || output.type !== "chunk") continue;
        initialFiles.add(fileName);
        pending.push(...output.imports);
      }

      const initialChunks: typeof chunks = [];
      for (const fileName of initialFiles) {
        const output = bundle[fileName];
        if (output?.type === "chunk") initialChunks.push(output);
      }
      const initialRawBytes = initialChunks.reduce((sum, chunk) => sum + byteLength(chunk.code), 0);
      const initialGzipBytes = initialChunks.reduce(
        (sum, chunk) => sum + gzipSync(chunk.code).byteLength,
        0,
      );
      const initialModuleIds = initialChunks.flatMap((chunk) => Object.keys(chunk.modules));
      const heavyModulesInInitialGraph = HEAVY_STARTUP_MODULE_MARKERS.filter((marker) =>
        initialModuleIds.some((moduleId) => moduleId.replaceAll("\\", "/").includes(marker)),
      );
      const javascriptChunks = chunks
        .map((chunk) => ({
          file: chunk.fileName,
          entry: chunk.isEntry,
          dynamicEntry: chunk.isDynamicEntry,
          rawBytes: byteLength(chunk.code),
          gzipBytes: gzipSync(chunk.code).byteLength,
          modules: Object.keys(chunk.modules).length,
        }))
        .sort((left, right) => right.gzipBytes - left.gzipBytes);

      const report = {
        schemaVersion: 1,
        entry: appEntry.fileName,
        initialGraph: {
          files: [...initialFiles].sort(),
          rawBytes: initialRawBytes,
          gzipBytes: initialGzipBytes,
          heavyModules: heavyModulesInInitialGraph,
        },
        javascriptChunks,
      };

      this.emitFile({
        type: "asset",
        fileName: "hawya-build-metrics.json",
        source: `${JSON.stringify(report, null, 2)}\n`,
      });
    },
  };
}
