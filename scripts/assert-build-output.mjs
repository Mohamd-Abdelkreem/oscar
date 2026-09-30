import { access, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredArtifacts = [
  "apps/api/dist/server.js",
  "apps/api/dist/app.js",
  "packages/contracts/dist/index.js",
  "packages/contracts/dist/index.d.ts",
  "packages/database/dist/index.js",
  "packages/database/dist/index.d.ts",
];
const outputDirectories = [
  "apps/api/dist",
  "packages/contracts/dist",
  "packages/database/dist",
];
const testArtifactPattern = /\.(?:test|spec)\.(?:[cm]?js|d\.ts)(?:\.map)?$/u;

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : [path];
    }),
  );
  return files.flat();
};

const missingArtifacts = [];
for (const artifact of requiredArtifacts) {
  try {
    await access(join(repositoryRoot, artifact));
  } catch {
    missingArtifacts.push(artifact);
  }
}

const emittedFiles = (
  await Promise.all(
    outputDirectories.map((directory) =>
      collectFiles(join(repositoryRoot, directory)),
    ),
  )
).flat();
const testArtifacts = emittedFiles
  .map((file) => relative(repositoryRoot, file).split(sep).join("/"))
  .filter((file) => testArtifactPattern.test(file));

if (missingArtifacts.length > 0 || testArtifacts.length > 0) {
  const failures = [
    ...missingArtifacts.map((file) => `Missing required artifact: ${file}`),
    ...testArtifacts.map((file) => `Test artifact emitted: ${file}`),
  ];
  throw new Error(`Build output verification failed:\n${failures.join("\n")}`);
}

process.stdout.write(
  `Build output verified: ${String(requiredArtifacts.length)} required entry artifacts present; ${String(emittedFiles.length)} emitted files contain no test artifacts.\n`,
);
