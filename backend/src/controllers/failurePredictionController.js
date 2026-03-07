/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const { predictServiceFailures } = require("../services/failurePrediction/failurePredictionEngineService");

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

async function predictFailure(req, res) {
  try {
    const {
      repositoryId,
      serviceMetrics,
      simulationResults,
    } = req.body;

    if (!serviceMetrics) {
      return res.status(400).json({
        error: "validation_error",
        message: "serviceMetrics is required",
      });
    }

    const userId = req.auth.sub;
    if (repositoryId) {
      await ensureRepositoryAccess(repositoryId, userId);
    }

    const prediction = await predictServiceFailures({
      repositoryId,
      serviceMetrics,
      simulationResults,
    });

    if (prediction.predictions.length === 1) {
      const single = prediction.predictions[0];
      return res.status(200).json({
        message: "Failure prediction completed",
        service: single.service,
        failureProbability: single.failureProbability,
        riskLevel: single.riskLevel,
        recommendedMitigation: single.recommendedMitigation,
        reason: single.reason,
        model: prediction.model,
      });
    }

    return res.status(200).json({
      message: "Failure prediction completed",
      model: prediction.model,
      predictions: prediction.predictions,
    });
  } catch (err) {
    return handleError(res, err, "Failed to predict service failures");
  }
}

module.exports = {
  predictFailure,
};
