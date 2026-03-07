/* eslint-disable @typescript-eslint/no-require-imports */
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const { getDashboardOverview } = require("../services/dashboard/dashboardOverviewService");

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

async function getOverview(req, res) {
  try {
    const workspaceId = req.query.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId query param is required",
      });
    }

    const userId = req.auth.sub;
    const { role } = await requireWorkspaceMember(String(workspaceId), userId);
    enforceAction(role, "view_dashboard");

    const overview = await getDashboardOverview({ workspaceId });

    return res.status(200).json(overview);
  } catch (err) {
    return handleError(res, err, "Failed to fetch dashboard overview");
  }
}

module.exports = {
  getOverview,
};
