/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const Workspace = require("../models/Workspace");
const AnalysisResult = require("../models/AnalysisResult");
const { resolveRole, hasPermission } = require("../middleware/rbac");
const { enqueueRepositoryAnalysis } = require("../utils/analysisQueue");

function validateInfrastructure(infrastructure) {
  if (!infrastructure || typeof infrastructure !== "object") {
    const err = new Error("infrastructure is required");
    err.status = 400;
    throw err;
  }

  const provider = String(infrastructure.provider || "").trim();
  const cpu = Number(infrastructure.cpu);
  const memory = Number(infrastructure.memory);
  const storage = Number(infrastructure.storage);

  if (!provider || !Number.isFinite(cpu) || !Number.isFinite(memory) || !Number.isFinite(storage)) {
    const err = new Error("infrastructure must include provider, cpu, memory, storage");
    err.status = 400;
    throw err;
  }

  return {
    provider,
    cpu,
    memory,
    storage,
  };
}

async function resolveWorkspaceForUser(userId, workspaceId) {
  if (workspaceId) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      const err = new Error("workspace not found");
      err.status = 404;
      throw err;
    }

    const role = resolveRole(workspace, userId);
    if (!role) {
      const err = new Error("You do not have access to this workspace");
      err.status = 403;
      throw err;
    }

    return { workspace, role };
  }

  const workspace = await Workspace.findOne({
    $or: [{ ownerId: userId }, { "members.userId": userId }],
  }).sort({ updatedAt: -1 });

  if (!workspace) {
    const err = new Error("No workspace found for this user");
    err.status = 404;
    throw err;
  }

  const role = resolveRole(workspace, userId);
  if (!role) {
    const err = new Error("You do not have access to this workspace");
    err.status = 403;
    throw err;
  }

  return { workspace, role };
}

function parseRepoName(repoUrl) {
  try {
    const pathname = new URL(repoUrl).pathname;
    const name = pathname.split("/").filter(Boolean).pop() || "repository";
    return name.replace(/\.git$/i, "");
  } catch {
    return "repository";
  }
}

async function createOrUpdateRepository({ repoUrl, branch, workspaceId, userId }) {
  const repoName = parseRepoName(repoUrl);

  const repository = await Repository.findOneAndUpdate(
    {
      workspaceId,
      repoUrl,
    },
    {
      $set: {
        name: repoName,
        url: repoUrl,
        repoUrl,
        provider: "github",
        defaultBranch: branch || "main",
        ownerId: userId,
        createdBy: userId,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return repository;
}

function handleError(res, err, fallbackMessage) {
  console.error(fallbackMessage, err);
  return res.status(err.status || 500).json({
    error: err.status && err.status < 500 ? "request_error" : "server_error",
    message: err.message || fallbackMessage,
  });
}

async function enqueueRepositoryAnalysisRequest(req, res) {
  try {
    const { repoUrl, branch = "main", infrastructure, workspaceId } = req.body;

    if (!repoUrl || typeof repoUrl !== "string") {
      return res.status(400).json({
        error: "validation_error",
        message: "repoUrl is required",
      });
    }

    const userId = req.auth.sub;
    const { workspace, role } = await resolveWorkspaceForUser(userId, workspaceId);

    if (!hasPermission(role, "connect_repository")) {
      return res.status(403).json({
        error: "forbidden",
        message: "You do not have permission to run repository analysis",
      });
    }

    const normalizedInfrastructure = validateInfrastructure(infrastructure);

    const repository = await createOrUpdateRepository({
      repoUrl,
      branch,
      workspaceId: workspace._id,
      userId,
    });

    const analysisResult = await AnalysisResult.findOneAndUpdate(
      {
        repositoryId: repository._id,
      },
      {
        repositoryId: repository._id,
        workspaceId: workspace._id,
        createdBy: userId,
        status: "queued",
        branch,
        infrastructure: normalizedInfrastructure,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        result: null,
        metadataSnapshot: null,
        error: {
          message: "",
          stack: "",
          failedAt: null,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    const job = await enqueueRepositoryAnalysis({
      analysisId: String(analysisResult._id),
      repositoryId: String(repository._id),
      repoUrl,
      branch,
      infrastructure: normalizedInfrastructure,
      requestedBy: userId,
    });

    analysisResult.lastJobId = String(job.id);
    await analysisResult.save();

    return res.status(202).json({
      message: "Repository analysis queued",
      repositoryId: String(repository._id),
      analysisId: String(analysisResult._id),
      status: analysisResult.status,
      jobId: String(job.id),
    });
  } catch (err) {
    return handleError(res, err, "Failed to queue repository analysis");
  }
}

async function getAnalysisByRepositoryId(req, res) {
  try {
    const { repoId } = req.params;
    const userId = req.auth.sub;

    const repository = await Repository.findById(repoId);
    if (!repository) {
      return res.status(404).json({
        error: "not_found",
        message: "Repository not found",
      });
    }

    const workspace = await Workspace.findById(repository.workspaceId);
    if (!workspace) {
      return res.status(404).json({
        error: "not_found",
        message: "Workspace not found",
      });
    }

    const role = resolveRole(workspace, userId);
    if (!role || !hasPermission(role, "view_dashboard")) {
      return res.status(403).json({
        error: "forbidden",
        message: "You do not have access to this analysis",
      });
    }

    const analysis = await AnalysisResult.findOne({ repositoryId: repository._id });
    if (!analysis) {
      return res.status(404).json({
        error: "not_found",
        message: "Analysis not found for this repository",
      });
    }

    return res.status(200).json({
      repositoryId: String(repository._id),
      analysisId: String(analysis._id),
      status: analysis.status,
      branch: analysis.branch,
      infrastructure: analysis.infrastructure,
      queuedAt: analysis.queuedAt,
      startedAt: analysis.startedAt,
      completedAt: analysis.completedAt,
      error: analysis.error,
      result: analysis.result,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve analysis result");
  }
}

module.exports = {
  enqueueRepositoryAnalysisRequest,
  getAnalysisByRepositoryId,
};
