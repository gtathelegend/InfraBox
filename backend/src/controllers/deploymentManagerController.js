/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  runDeployment,
  SUPPORTED_TARGETS,
  getDeploymentHistory,
  getDeploymentLogs,
  deploymentEvents,
} = require("../services/deploymentManager/deploymentManagerService");
const Deployment = require("../models/Deployment");

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

async function getDeploymentHistoryController(req, res) {
  try {
    const { workspaceId, repositoryId, limit } = req.query;
    const userId = req.auth.sub;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId is required",
      });
    }

    const { role } = await requireWorkspaceMember(String(workspaceId), userId);
    enforceAction(role, "view_deployments");

    const history = await getDeploymentHistory({
      workspaceId: String(workspaceId),
      repositoryId: repositoryId ? String(repositoryId) : null,
      limit,
    });

    return res.status(200).json({
      message: "Deployment history retrieved",
      workspaceId,
      count: history.length,
      deployments: history,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve deployment history");
  }
}

async function getDeploymentLogsController(req, res) {
  try {
    const { deploymentId } = req.params;
    const userId = req.auth.sub;

    if (!deploymentId) {
      return res.status(400).json({
        error: "validation_error",
        message: "deploymentId is required",
      });
    }

    const deployment = await Deployment.findById(deploymentId).lean();
    if (!deployment) {
      return res.status(404).json({
        error: "not_found",
        message: "Deployment not found",
      });
    }

    const { role } = await requireWorkspaceMember(String(deployment.workspaceId), userId);
    enforceAction(role, "view_deployments");

    const logs = await getDeploymentLogs(deploymentId);
    return res.status(200).json({
      message: "Deployment logs retrieved",
      ...logs,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve deployment logs");
  }
}

async function streamDeploymentEventsController(req, res) {
  try {
    const { workspaceId } = req.query;
    const userId = req.auth.sub;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId is required",
      });
    }

    const { role } = await requireWorkspaceMember(String(workspaceId), userId);
    enforceAction(role, "view_deployments");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (eventName, payload) => {
      if (String(payload?.workspaceId) !== String(workspaceId)) return;
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const onBuildStarted = (payload) => send("build_started", payload);
    const onBuildCompleted = (payload) => send("build_completed", payload);
    const onDeployStarted = (payload) => send("deploy_started", payload);
    const onDeployCompleted = (payload) => send("deploy_completed", payload);
    const onDeployFailed = (payload) => send("deploy_failed", payload);

    deploymentEvents.on("build_started", onBuildStarted);
    deploymentEvents.on("build_completed", onBuildCompleted);
    deploymentEvents.on("deploy_started", onDeployStarted);
    deploymentEvents.on("deploy_completed", onDeployCompleted);
    deploymentEvents.on("deploy_failed", onDeployFailed);

    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ workspaceId, timestamp: new Date().toISOString() })}\n\n`);

    req.on("close", () => {
      deploymentEvents.off("build_started", onBuildStarted);
      deploymentEvents.off("build_completed", onBuildCompleted);
      deploymentEvents.off("deploy_started", onDeployStarted);
      deploymentEvents.off("deploy_completed", onDeployCompleted);
      deploymentEvents.off("deploy_failed", onDeployFailed);
      res.end();
    });
  } catch (err) {
    return handleError(res, err, "Failed to stream deployment events");
  }
}

module.exports = {
  runDeploymentController,
  getDeploymentHistoryController,
  getDeploymentLogsController,
  streamDeploymentEventsController,
};
