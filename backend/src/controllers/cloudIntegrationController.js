/* eslint-disable @typescript-eslint/no-require-imports */
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  connectCloudProvider,
  fetchInfrastructureMetrics,
  fetchBillingMetrics,
} = require("../services/cloudIntegration/cloudIntegrationService");

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

async function connectCloud(req, res) {
  try {
    const { workspaceId, provider, credentials, region } = req.body;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId is required",
      });
    }

    if (!provider) {
      return res.status(400).json({
        error: "validation_error",
        message: "provider is required",
      });
    }

    if (!credentials || typeof credentials !== "object") {
      return res.status(400).json({
        error: "validation_error",
        message: "credentials object is required",
      });
    }

    const userId = req.auth.sub;
    const { role } = await requireWorkspaceMember(workspaceId, userId);
    enforceAction(role, "manage_integrations");

    const integration = await connectCloudProvider({
      workspaceId,
      provider,
      credentials,
      region,
      userId,
    });

    return res.status(200).json({
      message: `${provider} cloud integration connected successfully`,
      integration,
    });
  } catch (err) {
    return handleError(res, err, "Failed to connect cloud integration");
  }
}

async function getInfrastructureMetrics(req, res) {
  try {
    const workspaceId = req.query.workspaceId;
    const provider = req.query.provider;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId query param is required",
      });
    }

    const userId = req.auth.sub;
    const { role } = await requireWorkspaceMember(workspaceId, userId);
    enforceAction(role, "view_dashboard");

    const metrics = await fetchInfrastructureMetrics({ workspaceId, provider });

    return res.status(200).json({
      message: "Infrastructure metrics fetched successfully",
      count: metrics.length,
      metrics,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch infrastructure metrics");
  }
}

async function getBillingData(req, res) {
  try {
    const workspaceId = req.query.workspaceId;
    const provider = req.query.provider;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId query param is required",
      });
    }

    const userId = req.auth.sub;
    const { role } = await requireWorkspaceMember(workspaceId, userId);
    enforceAction(role, "view_dashboard");

    const billing = await fetchBillingMetrics({ workspaceId, provider });

    return res.status(200).json({
      message: "Billing data fetched successfully",
      count: billing.length,
      billing,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch billing data");
  }
}

module.exports = {
  connectCloud,
  getInfrastructureMetrics,
  getBillingData,
};
