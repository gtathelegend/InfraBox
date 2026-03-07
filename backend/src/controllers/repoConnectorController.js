/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  connectProvider,
  importRepositories,
  fetchBranches,
  fetchCommits,
  fetchPullRequests,
} = require("../services/repoConnector/repositoryConnectorService");

function enforceAction(role, action) {
  if (!hasPermission(role, action)) {
    const err = new Error("You do not have permission to perform this action");
    err.status = 403;
    throw err;
  }
}

function handleError(res, err, fallbackMessage) {
  console.error(fallbackMessage, err);
  return res.status(err.status || 500).json({
    error: err.status && err.status < 500 ? "request_error" : "server_error",
    message: err.message || fallbackMessage,
  });
}

async function connectRepository(req, res) {
  try {
    const { provider, workspaceId, code, accessToken, redirectUri } = req.body;

    if (!provider) {
      return res.status(400).json({ error: "validation_error", message: "provider is required" });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: "validation_error", message: "workspaceId is required" });
    }

    const userId = req.auth.sub;
    const { role } = await requireWorkspaceMember(workspaceId, userId);
    enforceAction(role, "connect_repository");

    const result = await connectProvider({
      provider: provider.toLowerCase(),
      workspaceId,
      ownerId: userId,
      code,
      accessToken,
      redirectUri,
    });

    return res.status(200).json({
      message: `${provider} connected successfully`,
      connection: result.connection,
      providerUser: result.providerUser,
    });
  } catch (err) {
    return handleError(res, err, "Failed to connect repository provider");
  }
}

async function importProviderRepositories(req, res) {
  try {
    const provider = (req.query.provider || "").toLowerCase();
    const workspaceId = req.query.workspaceId;

    if (!provider) {
      return res.status(400).json({ error: "validation_error", message: "provider query param is required" });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: "validation_error", message: "workspaceId query param is required" });
    }

    const userId = req.auth.sub;
    const { role } = await requireWorkspaceMember(workspaceId, userId);
    enforceAction(role, "connect_repository");

    const repositories = await importRepositories({
      provider,
      workspaceId,
      ownerId: userId,
    });

    return res.status(200).json({
      message: "Repositories imported successfully",
      count: repositories.length,
      repositories,
    });
  } catch (err) {
    return handleError(res, err, "Failed to import repositories");
  }
}

async function ensureRepositoryAccess(repoId, userId) {
  const repository = await Repository.findById(repoId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  const { role } = await requireWorkspaceMember(String(repository.workspaceId), userId);
  enforceAction(role, "view_dashboard");
  return repository;
}

async function getRepositoryBranches(req, res) {
  try {
    const repository = await ensureRepositoryAccess(req.params.repoId, req.auth.sub);
    const branches = await fetchBranches({ repository });

    return res.status(200).json({
      message: "Branches fetched successfully",
      count: branches.length,
      branches,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch branches");
  }
}

async function getRepositoryCommits(req, res) {
  try {
    const repository = await ensureRepositoryAccess(req.params.repoId, req.auth.sub);
    const commits = await fetchCommits({ repository });

    return res.status(200).json({
      message: "Commits fetched successfully",
      count: commits.length,
      commits,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch commits");
  }
}

async function getRepositoryPullRequests(req, res) {
  try {
    const repository = await ensureRepositoryAccess(req.params.repoId, req.auth.sub);
    const pullRequests = await fetchPullRequests({ repository });

    return res.status(200).json({
      message: "Pull requests fetched successfully",
      count: pullRequests.length,
      pullRequests,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch pull requests");
  }
}

module.exports = {
  connectRepository,
  importProviderRepositories,
  getRepositoryBranches,
  getRepositoryCommits,
  getRepositoryPullRequests,
};
