/* eslint-disable @typescript-eslint/no-require-imports */
const os = require("os");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const Repository = require("../../models/Repository");
const GitConnection = require("../../models/GitConnection");

const execFileAsync = promisify(execFile);

function buildAuthenticatedCloneUrl(repoUrl, provider, accessToken) {
  if (!repoUrl || !accessToken || !repoUrl.startsWith("https://")) {
    return repoUrl;
  }

  const url = new URL(repoUrl);

  if (provider === "github") {
    url.username = "x-access-token";
    url.password = accessToken;
  } else if (provider === "gitlab") {
    url.username = "oauth2";
    url.password = accessToken;
  } else if (provider === "bitbucket") {
    url.username = "x-token-auth";
    url.password = accessToken;
  }

  return url.toString();
}

async function resolveRepository(repositoryId) {
  const repository = await Repository.findById(repositoryId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  return repository;
}

async function cloneRepositoryToTempWorkspace(repositoryId, options = {}) {
  const repository = await resolveRepository(repositoryId);
  const repoUrl = repository.repoUrl || repository.url;

  if (!repoUrl) {
    const err = new Error("Repository URL is not available");
    err.status = 400;
    throw err;
  }

  const tempRoot = path.join(os.tmpdir(), "infrabox-analysis", crypto.randomUUID());
  const cloneDir = path.join(tempRoot, "repo");
  await fs.mkdir(cloneDir, { recursive: true });

  let cloneUrl = repoUrl;
  if (["github", "gitlab", "bitbucket"].includes(repository.provider)) {
    const connection = await GitConnection.findOne({
      provider: repository.provider,
      workspaceId: repository.workspaceId,
      ownerId: repository.ownerId,
    });

    if (connection?.accessToken) {
      cloneUrl = buildAuthenticatedCloneUrl(repoUrl, repository.provider, connection.accessToken);
    }
  }

  try {
    const cloneArgs = ["clone"];
    if (!options.fullHistory) {
      cloneArgs.push("--depth", String(options.depth || 1));
    }
    cloneArgs.push(cloneUrl, cloneDir);

    await execFileAsync("git", cloneArgs, {
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 5,
    });

    return { repository, tempRoot, cloneDir };
  } catch (error) {
    const err = new Error(`Failed to clone repository: ${error.message}`);
    err.status = 500;
    throw err;
  }
}

async function cleanupTempWorkspace(tempRoot) {
  if (!tempRoot) return;
  await fs.rm(tempRoot, { recursive: true, force: true });
}

module.exports = {
  cloneRepositoryToTempWorkspace,
  cleanupTempWorkspace,
};
