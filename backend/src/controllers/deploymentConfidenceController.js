/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  calculateDeploymentConfidence,
  getDeploymentConfidenceHistory,
  approveDeployment,
} = require("../services/deploymentConfidence/deploymentConfidenceScoringService");

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

async function scoreDeployment(req, res) {
  try {
    const { repositoryId, workspaceId, signals } = req.body;
    const userId = req.auth.sub;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    // Verify repository access
    const repository = await ensureRepositoryAccess(repositoryId, userId);

    const deploymentConfidence = await calculateDeploymentConfidence({
      repositoryId,
      workspaceId: workspaceId || repository.workspaceId,
      signals,
    });

    return res.status(200).json({
      message: "Deployment confidence score calculated",
      ...deploymentConfidence,
    });
  } catch (err) {
    return handleError(res, err, "Failed to calculate deployment confidence");
  }
}

async function getConfidenceHistory(req, res) {
  try {
    const { repositoryId } = req.params;
    const { limit } = req.query;
    const userId = req.auth.sub;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    // Verify repository access
    await ensureRepositoryAccess(repositoryId, userId);

    const history = await getDeploymentConfidenceHistory(
      repositoryId,
      Math.min(parseInt(limit, 10) || 10, 100)
    );

    return res.status(200).json({
      message: "Deployment confidence history retrieved",
      repositoryId,
      count: history.length,
      scores: history,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve deployment confidence history");
  }
}

async function approveForDeployment(req, res) {
  try {
    const { scoreId } = req.params;
    const userId = req.auth.sub;

    if (!scoreId) {
      return res.status(400).json({
        error: "validation_error",
        message: "scoreId is required",
      });
    }

    const updated = await approveDeployment(scoreId, userId);

    return res.status(200).json({
      message: "Deployment approved",
      scoreId: String(updated._id),
      confidenceScore: updated.confidenceScore,
      riskLevel: updated.riskLevel,
      deploymentApprovedAt: updated.deploymentApprovedAt,
      approvedBy: updated.approvedBy,
    });
  } catch (err) {
    return handleError(res, err, "Failed to approve deployment");
  }
}

module.exports = {
  scoreDeployment,
  getConfidenceHistory,
  approveForDeployment,
};
