/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const { predictCloudCost, getCostPredictions } = require("../services/costPrediction/costPredictionEngineService");

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
  if (!repoId) return null;

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

async function predictCost(req, res) {
  try {
    const {
      repositoryId,
      workspaceId,
      metrics,
      provider,
      trafficSpikeFactor,
      assumptions,
    } = req.body;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId is required",
      });
    }

    const userId = req.auth.sub;

    if (repositoryId) {
      await ensureRepositoryAccess(repositoryId, userId);
    } else {
      const { role } = await requireWorkspaceMember(workspaceId, userId);
      enforceAction(role, "view_dashboard");
    }

    const prediction = await predictCloudCost({
      repositoryId: repositoryId || null,
      workspaceId,
      metrics,
      provider: provider || "generic",
      trafficSpikeFactor: trafficSpikeFactor || 1,
      assumptions: assumptions || {},
    });

    return res.status(200).json({
      message: "Cloud cost prediction completed",
      monthlyCostEstimate: prediction.monthlyCostEstimate,
      spikeCostEstimate: prediction.spikeCostEstimate,
      costBreakdown: prediction.costBreakdown,
      inputMetrics: prediction.inputMetrics,
      assumptions: prediction.assumptions,
      predictionId: prediction.predictionId,
    });
  } catch (err) {
    return handleError(res, err, "Failed to predict cloud costs");
  }
}

async function listPredictions(req, res) {
  try {
    const { workspaceId } = req.params;
    const userId = req.auth.sub;

    const { role } = await requireWorkspaceMember(workspaceId, userId);
    enforceAction(role, "view_dashboard");

    const predictions = await getCostPredictions(workspaceId);

    return res.status(200).json({
      message: "Cost predictions retrieved",
      workspaceId,
      count: predictions.length,
      predictions,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve cost predictions");
  }
}

module.exports = {
  predictCost,
  listPredictions,
};
