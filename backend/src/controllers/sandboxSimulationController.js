/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  runSandboxSimulation,
  getSimulationResultsByRepository,
} = require("../services/sandboxSimulation/sandboxSimulationEngineService");

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

async function runSimulation(req, res) {
  try {
    const { repositoryId, pipelineId } = req.body;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    const userId = req.auth.sub;
    await ensureRepositoryAccess(repositoryId, userId, "run_simulation");

    const result = await runSandboxSimulation({
      repositoryId,
      pipelineId,
    });

    return res.status(200).json({
      message: "Sandbox simulation completed",
      result: result.simulationResult,
      stageResults: result.stageResults,
    });
  } catch (err) {
    return handleError(res, err, "Failed to run sandbox simulation");
  }
}

async function getSimulationResults(req, res) {
  try {
    const { repoId } = req.params;
    const userId = req.auth.sub;

    await ensureRepositoryAccess(repoId, userId, "view_dashboard");

    const results = await getSimulationResultsByRepository(repoId);

    return res.status(200).json({
      message: "Simulation results retrieved successfully",
      repositoryId: repoId,
      count: results.length,
      results,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch simulation results");
  }
}

module.exports = {
  runSimulation,
  getSimulationResults,
};
