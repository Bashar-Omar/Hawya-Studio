import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const METRICS_PATH = resolve("dist/hawya-build-metrics.json");
const MAX_INITIAL_GZIP_BYTES = 160 * 1024;

const report = JSON.parse(await readFile(METRICS_PATH, "utf8"));
const failures = [];

if (typeof report?.initialGraph?.gzipBytes !== "number") {
  failures.push("build metrics are missing initialGraph.gzipBytes");
} else if (report.initialGraph.gzipBytes > MAX_INITIAL_GZIP_BYTES) {
  failures.push(
    `initial startup graph is ${report.initialGraph.gzipBytes} gzip bytes; budget is ${MAX_INITIAL_GZIP_BYTES}`,
  );
}

if (!Array.isArray(report?.initialGraph?.heavyModules)) {
  failures.push("build metrics are missing initialGraph.heavyModules");
} else if (report.initialGraph.heavyModules.length > 0) {
  failures.push(
    `heavy modules leaked into startup: ${report.initialGraph.heavyModules.join(", ")}`,
  );
}

if (failures.length > 0) {
  console.error("Stage 10 startup budget failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Stage 10 startup budget passed: ${report.initialGraph.gzipBytes} / ${MAX_INITIAL_GZIP_BYTES} gzip bytes; heavy modules: none.`,
  );
}
