/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  parseRepositoryPipelines,
  getParsedPipelines,
} = require("../services/pipelineParser/pipelineParserService");
const {
  fetchPipelineMetrics,
} = require("../services/pipelineParser/pipelineMetricsCollectorService");

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

async function parsePipeline(req, res) {
  try {
    const { repositoryId } = req.body;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    const userId = req.auth.sub;
    const repository = await ensureRepositoryAccess(repositoryId, userId);

    const pipelines = await parseRepositoryPipelines(repository._id);

    return res.status(200).json({
      message: "Pipeline parsing completed successfully",
      repositoryId: String(repository._id),
      count: pipelines.length,
      pipelines,
    });
  } catch (err) {
    return handleError(res, err, "Failed to parse CI/CD pipeline");
  }
}

async function getPipeline(req, res) {
  try {
    const { repoId } = req.params;
    const userId = req.auth.sub;

    await ensureRepositoryAccess(repoId, userId);

    const pipelines = await getParsedPipelines(repoId);

    return res.status(200).json({
      message: "Pipeline structure fetched successfully",
      repositoryId: repoId,
      count: pipelines.length,
      pipelines,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch pipeline structure");
  }
}

async function getPipelineMetrics(req, res) {
  try {
    const { repoId } = req.params;
    const userId = req.auth.sub;

    const repository = await ensureRepositoryAccess(repoId, userId);
    const metrics = await fetchPipelineMetrics(repository);

    return res.status(200).json({
      message: "Pipeline metrics fetched successfully",
      repositoryId: repoId,
      pipelineSuccessRate: metrics.pipelineSuccessRate,
      totalStageExecutions: metrics.totalStageExecutions,
      stageMetrics: metrics.stageMetrics,
      rawMetrics: metrics.rawMetrics,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch pipeline metrics");
  }
}

module.exports = {
  parsePipeline,
  getPipeline,
  getPipelineMetrics,
};
