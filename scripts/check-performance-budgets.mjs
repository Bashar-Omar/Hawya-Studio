import { readFile } from "node:fs/promises";

const REPORT_PATH = new URL("../dist/hawya-build-metrics.json", import.meta.url);
const MAX_INITIAL_GZIP_BYTES = 160 * 1024;
const MAX_INITIAL_CHUNK_GZIP_BYTES = 128 * 1024;

const report = JSON.parse(await readFile(REPORT_PATH, "utf8"));
const failures = [];

if (report.initialGraph.gzipBytes > MAX_INITIAL_GZIP_BYTES) {
  failures.push(
    `Initial JavaScript graph is ${report.initialGraph.gzipBytes} gzip bytes; budget is ${MAX_INITIAL_GZIP_BYTES}.`,
  );
}

if (report.initialGraph.heavyModules.length > 0) {
  failures.push(
    `Heavy feature modules leaked into startup: ${report.initialGraph.heavyModules.join(", ")}.`,
  );
}

const initialFiles = new Set(report.initialGraph.files);
const oversizedInitialChunks = report.javascriptChunks.filter(
  (chunk) => initialFiles.has(chunk.file) && chunk.gzipBytes > MAX_INITIAL_CHUNK_GZIP_BYTES,
);
if (oversizedInitialChunks.length > 0) {
  failures.push(
    `Initial chunks exceed the ${MAX_INITIAL_CHUNK_GZIP_BYTES}-byte gzip budget: ${oversizedInitialChunks
      .map((chunk) => `${chunk.file} (${chunk.gzipBytes})`)
      .join(", ")}.`,
  );
}

console.log(
  `Stage 10 startup budget: ${report.initialGraph.gzipBytes}/${MAX_INITIAL_GZIP_BYTES} gzip bytes across ${report.initialGraph.files.length} initial chunks.`,
);

if (failures.length > 0) {
  for (const failure of failures) console.error(`Performance budget failed: ${failure}`);
  process.exitCode = 1;
}
