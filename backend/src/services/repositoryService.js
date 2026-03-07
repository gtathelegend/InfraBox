/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "target",
  "vendor",
  "tmp",
  "temp",
]);

const DEPENDENCY_FILES = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "requirements.txt",
  "Pipfile",
  "Pipfile.lock",
  "pyproject.toml",
  "poetry.lock",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "go.mod",
  "Cargo.toml",
  "composer.json",
  "Gemfile",
]);

const PIPELINE_EXACT = new Set([
  ".gitlab-ci.yml",
  "Jenkinsfile",
  "azure-pipelines.yml",
  "bitbucket-pipelines.yml",
  ".circleci/config.yml",
  "cloudbuild.yaml",
  "cloudbuild.yml",
]);

function normalizePathForGit(filePath) {
  return filePath.split(path.sep).join("/");
}

function isPipelineFile(relativePath) {
  const normalized = normalizePathForGit(relativePath);
  if (PIPELINE_EXACT.has(normalized)) {
    return true;
  }

  return normalized.startsWith(".github/workflows/") && /\.ya?ml$/i.test(normalized);
}

function isConfigFile(relativePath) {
  const filename = path.basename(relativePath);
  const normalized = normalizePathForGit(relativePath).toLowerCase();

  if (filename === "Dockerfile" || filename.startsWith("Dockerfile.")) return true;
  if (normalized.includes("docker-compose")) return true;
  if (normalized.endsWith(".tf") || normalized.endsWith(".tfvars")) return true;
  if (normalized.includes("k8s/") || normalized.includes("kubernetes/")) return true;
  if (normalized.endsWith("helm/Chart.yaml".toLowerCase())) return true;

  return false;
}

async function cloneRepository(repoUrl, branch = "main") {
  if (!repoUrl || typeof repoUrl !== "string") {
    const err = new Error("repoUrl is required");
    err.status = 400;
    throw err;
  }

  const tempRoot = path.join(os.tmpdir(), "infrabox-repos", crypto.randomUUID());
  const cloneDir = path.join(tempRoot, "repo");
  await fs.mkdir(tempRoot, { recursive: true });

  const args = ["clone", "--depth", "200"];
  if (branch) {
    args.push("--branch", branch);
  }
  args.push(repoUrl, cloneDir);

  await execFileAsync("git", args, {
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 1024 * 1024 * 10,
  });

  return {
    clonePath: cloneDir,
    tempRoot,
  };
}

async function cleanupRepositoryClone(tempRoot) {
  if (!tempRoot) return;
  await fs.rm(tempRoot, { recursive: true, force: true });
}

async function walkRepository(rootPath, options = {}) {
  const maxDepth = options.maxDepth || 6;
  const maxEntries = options.maxEntries || 1500;
  const entries = [];

  async function walk(currentPath, depth) {
    if (entries.length >= maxEntries || depth > maxDepth) return;

    const dirEntries = await fs.readdir(currentPath, { withFileTypes: true });
    dirEntries.sort((a, b) => a.name.localeCompare(b.name));

    for (const dirEntry of dirEntries) {
      if (entries.length >= maxEntries) break;

      const absolutePath = path.join(currentPath, dirEntry.name);
      const relativePath = path.relative(rootPath, absolutePath);

      if (!relativePath) continue;

      if (dirEntry.isDirectory()) {
        if (IGNORED_DIRS.has(dirEntry.name)) continue;
        entries.push({ path: relativePath, type: "directory", depth });
        await walk(absolutePath, depth + 1);
      } else if (dirEntry.isFile()) {
        entries.push({ path: relativePath, type: "file", depth });
      }
    }
  }

  await walk(rootPath, 0);
  return entries;
}

function buildTreeString(walkEntries) {
  return walkEntries
    .map((entry) => {
      const indent = "  ".repeat(Math.max(0, entry.depth));
      const marker = entry.type === "directory" ? "[D]" : "[F]";
      return `${indent}${marker} ${normalizePathForGit(entry.path)}`;
    })
    .join("\n");
}

async function readTextFile(filePath, maxChars = 10000) {
  const fileContent = await fs.readFile(filePath, "utf8");
  if (fileContent.length <= maxChars) return fileContent;
  return `${fileContent.slice(0, maxChars)}\n\n...[truncated]`;
}

async function getGitCommitHistory(clonePath) {
  const gitArgs = [
    "log",
    "--pretty=format:%h|%an|%ad|%s",
    "--date=iso-strict",
    "-n",
    "200",
  ];

  const { stdout } = await execFileAsync("git", gitArgs, {
    cwd: clonePath,
    windowsHide: true,
    timeout: 90000,
    maxBuffer: 1024 * 1024 * 10,
  });

  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    raw: lines.join("\n"),
    records: lines.map((line) => {
      const [hash, author, date, ...subjectParts] = line.split("|");
      return {
        hash: hash || "",
        author: author || "",
        date: date || "",
        subject: subjectParts.join("|") || "",
      };
    }),
  };
}

async function extractRepositoryMetadata(clonePath) {
  const walkEntries = await walkRepository(clonePath);

  const dependencyFiles = [];
  const pipelineFiles = [];
  const configFiles = [];

  for (const entry of walkEntries) {
    if (entry.type !== "file") continue;

    const normalizedPath = normalizePathForGit(entry.path);
    const fileName = path.basename(entry.path);

    if (DEPENDENCY_FILES.has(fileName)) {
      dependencyFiles.push(normalizedPath);
    }

    if (isPipelineFile(entry.path)) {
      pipelineFiles.push(normalizedPath);
    }

    if (isConfigFile(entry.path)) {
      configFiles.push(normalizedPath);
    }
  }

  const dependenciesWithContent = await Promise.all(
    dependencyFiles.map(async (relativePath) => {
      const content = await readTextFile(path.join(clonePath, relativePath));
      return { file: relativePath, content };
    })
  );

  const pipelineWithContent = await Promise.all(
    pipelineFiles.map(async (relativePath) => {
      const content = await readTextFile(path.join(clonePath, relativePath));
      return { file: relativePath, content };
    })
  );

  const configWithContent = await Promise.all(
    configFiles.map(async (relativePath) => {
      const content = await readTextFile(path.join(clonePath, relativePath));
      return { file: relativePath, content };
    })
  );

  const commitHistory = await getGitCommitHistory(clonePath);

  return {
    repoStructure: buildTreeString(walkEntries),
    dependencies: dependenciesWithContent,
    commitHistory: commitHistory.raw,
    commitHistoryRecords: commitHistory.records,
    pipelineFiles: pipelineWithContent,
    configFiles: configWithContent,
  };
}

module.exports = {
  cloneRepository,
  cleanupRepositoryClone,
  extractRepositoryMetadata,
};
