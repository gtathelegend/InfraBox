/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const { runDigitalTwinSimulation } = require("../services/digitalTwin/digitalTwinService");

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

async function ensureRepositoryAccess(repoId, userId, action) {
  const repository = await Repository.findById(repoId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  const { role } = await requireWorkspaceMember(String(repository.workspaceId), userId);
  enforceAction(role, action);

  return repository;
}

async function simulateDigitalTwin(req, res) {
  try {
    const {
      repositoryId,
      trafficLevel,
      baselineTraffic,
      memoryLimit,
      latencyThreshold,
      errorProbabilityThreshold,
    } = req.body;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    if (trafficLevel === undefined || trafficLevel === null || trafficLevel === "") {
      return res.status(400).json({
        error: "validation_error",
        message: "trafficLevel is required",
      });
    }

    const userId = req.auth.sub;
    await ensureRepositoryAccess(repositoryId, userId, "run_simulation");

    const result = await runDigitalTwinSimulation({
      repositoryId,
      trafficLevel,
      userId,
      options: {
        baselineTraffic,
        memoryLimit,
        latencyThreshold,
        errorProbabilityThreshold,
      },
    });

    return res.status(200).json({
      message: "Infrastructure digital twin simulation completed",
      repositoryId: result.repositoryId,
      trafficLevel: result.trafficLevel,
      predictedMetrics: result.predictedMetrics,
      riskIndicators: result.riskIndicators,
      context: {
        repositoryName: result.repositoryName,
        trafficFactor: result.trafficFactor,
        inputDataSummary: result.inputDataSummary,
      },
    });
  } catch (err) {
    return handleError(res, err, "Failed to simulate digital twin");
  }
}

module.exports = {
  simulateDigitalTwin,
};
