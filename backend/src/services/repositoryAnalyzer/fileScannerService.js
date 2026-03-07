/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs/promises");
const path = require("path");

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "venv",
  ".venv",
  "__pycache__",
]);

async function walkDirectory(rootDir) {
  const found = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        found.push(path.relative(rootDir, fullPath).replace(/\\/g, "/"));
      }
    }
  }

  await walk(rootDir);
  return found;
}

async function readIfExists(rootDir, relativePath) {
  try {
    const filePath = path.join(rootDir, relativePath);
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function scanRepositoryFiles(cloneDir) {
  const files = await walkDirectory(cloneDir);
  const lowerFiles = new Set(files.map((item) => item.toLowerCase()));

  const packageJsonRaw = await readIfExists(cloneDir, "package.json");
  const requirementsRaw = await readIfExists(cloneDir, "requirements.txt");
  const pyprojectRaw = await readIfExists(cloneDir, "pyproject.toml");
  const pomRaw = await readIfExists(cloneDir, "pom.xml");
  const dockerComposeRaw =
    (await readIfExists(cloneDir, "docker-compose.yml")) ||
    (await readIfExists(cloneDir, "docker-compose.yaml"));

  return {
    files,
    lowerFiles,
    packageJsonRaw,
    requirementsRaw,
    pyprojectRaw,
    pomRaw,
    dockerComposeRaw,
  };
}

module.exports = {
  scanRepositoryFiles,
};
