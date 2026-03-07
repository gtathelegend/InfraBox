/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  runDeployment,
  SUPPORTED_TARGETS,
} = require("../services/deploymentManager/deploymentManagerService");

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
    ...(err.details ? { details: err.details } : {}),
    ...(err.deploymentId ? { deploymentId: err.deploymentId } : {}),
    ...(err.timeline ? { timeline: err.timeline } : {}),
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
  enforceAction(role, "trigger_deployment");

  return repository;
}

async function runDeploymentController(req, res) {
  try {
    const { repositoryId, targetEnvironment, options } = req.body;
    const userId = req.auth.sub;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    if (!targetEnvironment) {
      return res.status(400).json({
        error: "validation_error",
        message: `targetEnvironment is required (${SUPPORTED_TARGETS.join(", ")})`,
      });
    }

    await ensureRepositoryAccess(repositoryId, userId);

    const deployment = await runDeployment({
      repositoryId,
      targetEnvironment,
      triggeredBy: userId,
      options: options || {},
    });

    return res.status(200).json({
      message: "Deployment workflow completed",
      deploymentStatus: deployment.deploymentStatus,
      deploymentUrl: deployment.deploymentUrl,
      deploymentId: deployment.deploymentId,
      targetEnvironment: deployment.targetEnvironment,
      image: deployment.image,
      safetyGate: deployment.safetyGate,
      timeline: deployment.timeline,
    });
  } catch (err) {
    return handleError(res, err, "Failed to run deployment workflow");
  }
}

module.exports = {
  runDeploymentController,
};
