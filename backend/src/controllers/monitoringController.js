/* eslint-disable @typescript-eslint/no-require-imports */
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const { getLatestMonitoringMetrics } = require("../services/monitoring/monitoringService");
const { runAnomalyDetection } = require("../services/monitoring/anomalyDetectionService");

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

async function getMonitoringMetrics(req, res) {
  try {
    const workspaceId = req.query.workspaceId;
    const serviceId = req.query.serviceId;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId query param is required",
      });
    }

    const userId = req.auth.sub;
    const { role } = await requireWorkspaceMember(String(workspaceId), userId);
    enforceAction(role, "view_dashboard");

    const metrics = await getLatestMonitoringMetrics({ workspaceId, serviceId });

    return res.status(200).json({
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage,
      latency: metrics.latency,
      errorRate: metrics.errorRate,
      traffic: metrics.traffic,
      cloudCost: metrics.cloudCost,
      timestamp: metrics.timestamp,
    });
  } catch (err) {
    return handleError(res, err, "Failed to fetch monitoring metrics");
  }
}

async function analyzeMonitoringAnomalies(req, res) {
  try {
    const { workspaceId, serviceId, thresholds } = req.body;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId is required",
      });
    }

    const userId = req.auth.sub;
    const { role } = await requireWorkspaceMember(String(workspaceId), userId);
    enforceAction(role, "view_dashboard");

    const result = await runAnomalyDetection({
      workspaceId,
      serviceId,
      thresholds: thresholds || {},
    });

    return res.status(200).json({
      anomalyDetected: result.anomalyDetected,
      affectedService: result.affectedService,
      severity: result.severity,
      impact: result.impact,
      findings: result.findings,
      latest: result.latest,
      baseline: result.baseline,
      thresholds: result.thresholds,
    });
  } catch (err) {
    return handleError(res, err, "Failed to analyze monitoring anomalies");
  }
}

module.exports = {
  getMonitoringMetrics,
  analyzeMonitoringAnomalies,
};
