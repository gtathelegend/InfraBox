/* eslint-disable @typescript-eslint/no-require-imports */
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const { triggerSelfHealing } = require("../services/healing/selfHealingTriggerService");

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

function tryExtractWorkspaceIdFromService(serviceId) {
  const fromPrefix = String(serviceId || "").match(/^workspace-([a-fA-F0-9]{24})$/);
  if (fromPrefix) return fromPrefix[1];
  return null;
}

async function triggerHealing(req, res) {
  try {
    const { serviceId, anomalyType, severity, workspaceId, repositoryId, context } = req.body;
    const userId = req.auth.sub;

    if (!serviceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "serviceId is required",
      });
    }

    if (!anomalyType) {
      return res.status(400).json({
        error: "validation_error",
        message: "anomalyType is required",
      });
    }

    if (!severity) {
      return res.status(400).json({
        error: "validation_error",
        message: "severity is required",
      });
    }

    const workspaceHint = workspaceId || tryExtractWorkspaceIdFromService(serviceId);
    if (workspaceHint) {
      const { role } = await requireWorkspaceMember(String(workspaceHint), userId);
      enforceAction(role, "manage_alerts");
    }

    const result = await triggerSelfHealing({
      serviceId,
      anomalyType,
      severity,
      userId,
      workspaceId,
      repositoryId: repositoryId || null,
      context: context || {},
    });

    return res.status(200).json({
      message: result.triggered
        ? "Self-healing trigger executed"
        : "Self-healing trigger skipped",
      ...result,
    });
  } catch (err) {
    return handleError(res, err, "Failed to trigger self-healing workflow");
  }
}

module.exports = {
  triggerHealing,
};
