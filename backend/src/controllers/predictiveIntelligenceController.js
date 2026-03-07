/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  orchestratePredictiveAnalysis,
  getPredictiveAnalysisHistory,
} = require("../services/predictiveIntelligence/predictiveIntelligenceOrchestratorService");

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

async function runFullAnalysis(req, res) {
  try {
    const { repositoryId, workspaceId, trafficScenario } = req.body;
    const userId = req.auth.sub;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    // Verify repository access
    const repository = await ensureRepositoryAccess(repositoryId, userId);

    const analysis = await orchestratePredictiveAnalysis({
      repositoryId,
      workspaceId: workspaceId || repository.workspaceId,
      trafficScenario: trafficScenario || "baseline",
    });

    return res.status(200).json({
      message: "Predictive intelligence analysis completed",
      ...analysis,
    });
  } catch (err) {
    return handleError(res, err, "Failed to run predictive analysis");
  }
}

async function getAnalysisHistory(req, res) {
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

    const history = await getPredictiveAnalysisHistory(
      repositoryId,
      Math.min(parseInt(limit, 10) || 10, 100)
    );

    return res.status(200).json({
      message: "Predictive analysis history retrieved",
      repositoryId,
      count: history.length,
      reports: history,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve analysis history");
  }
}

module.exports = {
  runFullAnalysis,
  getAnalysisHistory,
};
