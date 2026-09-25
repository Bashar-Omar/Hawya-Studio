import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "docs/release/DEPLOYMENT.md",
  "docs/release/RELEASE-CHECKLIST.md",
  "docs/licenses/FONT-LICENSES.md",
  "docs/licenses/THIRD-PARTY-NOTICES.md",
  "docs/licenses/ASSET-PROVENANCE.md",
  "docs/project-format/PROJECT-FILE-FORMAT.md",
  "docs/project-format/MIGRATIONS-AND-VERSIONING.md",
];

for (const file of requiredFiles) {
  const info = await stat(resolve(root, file)).catch(() => undefined);
  if (!info?.isFile()) throw new Error(`Release documentation is missing required file: ${file}`);
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (packageJson.license !== "MIT") throw new Error(`Expected package license MIT, got ${packageJson.license}`);
if (packageJson.version !== "0.1.0") {
  throw new Error(`Stage 12 release-doc gate expects package version 0.1.0, got ${packageJson.version}`);
}
if (packageJson.repository?.url !== "https://github.com/Bashar-Omar/Hawya-Studio.git") {
  throw new Error("package.json repository URL does not point at the canonical public repository");
}

const notices = await readFile(resolve(root, "docs/licenses/THIRD-PARTY-NOTICES.md"), "utf8");
for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
  if (!notices.includes(`\`${dependency}\``)) {
    throw new Error(`Direct production dependency is missing from third-party notices: ${dependency}`);
  }
}

const deployment = await readFile(resolve(root, "docs/release/DEPLOYMENT.md"), "utf8");
for (const statement of ["Required environment secrets: **none**", "pnpm build", "dist/"]) {
  if (!deployment.includes(statement)) throw new Error(`Deployment documentation is missing: ${statement}`);
}

console.log(
  `Release docs gate passed: ${requiredFiles.length} required files and ${Object.keys(packageJson.dependencies ?? {}).length} direct production dependencies documented.`,
);
