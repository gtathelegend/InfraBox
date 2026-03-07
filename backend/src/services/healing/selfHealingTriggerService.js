/* eslint-disable @typescript-eslint/no-require-imports */
const ServiceMetrics = require("../../models/ServiceMetrics");
const {
  createRemediationPlan,
  approveRemediationPlan,
  executeRemediationPlan,
} = require("../autonomousAgent/remediationPlannerService");

const HIGH_SEVERITY_VALUES = new Set(["high", "critical"]);

function normalizeSeverity(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAnomalyType(value) {
  return String(value || "unknown_anomaly").trim().toLowerCase();
}

async function resolveWorkspaceIdFromService(serviceId, workspaceId) {
  if (workspaceId) return String(workspaceId);

  const metric = await ServiceMetrics.findOne({ serviceId })
    .sort({ timestamp: -1 })
    .lean();

  if (metric?.workspaceId) {
    return String(metric.workspaceId);
  }

  const fromPrefix = String(serviceId || "").match(/^workspace-([a-fA-F0-9]{24})$/);
  if (fromPrefix) {
    return fromPrefix[1];
  }

  const err = new Error("workspaceId could not be inferred from serviceId; provide a known serviceId or workspaceId");
  err.status = 400;
  throw err;
}

async function triggerSelfHealing({
  serviceId,
  anomalyType,
  severity,
  userId,
  workspaceId,
  repositoryId = null,
  context = {},
}) {
  if (!serviceId) {
    const err = new Error("serviceId is required");
    err.status = 400;
    throw err;
  }

  if (!anomalyType) {
    const err = new Error("anomalyType is required");
    err.status = 400;
    throw err;
  }

  if (!severity) {
    const err = new Error("severity is required");
    err.status = 400;
    throw err;
  }

  const normalizedSeverity = normalizeSeverity(severity);
  const resolvedWorkspaceId = await resolveWorkspaceIdFromService(serviceId, workspaceId);

  if (!HIGH_SEVERITY_VALUES.has(normalizedSeverity)) {
    return {
      triggered: false,
      reason: `Self-healing is only triggered for high severity anomalies (received: ${normalizedSeverity})`,
      serviceId,
      anomalyType: normalizeAnomalyType(anomalyType),
      severity: normalizedSeverity,
      workspaceId: resolvedWorkspaceId,
    };
  }

  const plan = await createRemediationPlan({
    repositoryId: repositoryId || null,
    workspaceId: resolvedWorkspaceId,
    triggeredBy: "anomaly_detection",
    triggerContext: {
      detectionType: "anomaly_detection",
      serviceId,
      anomalyType: normalizeAnomalyType(anomalyType),
      severity: normalizedSeverity,
      ...context,
    },
    userId,
    automationEnabled: true,
  });

  await approveRemediationPlan(String(plan._id), userId);
  const executionResult = await executeRemediationPlan(String(plan._id));

  return {
    triggered: true,
    serviceId,
    anomalyType: normalizeAnomalyType(anomalyType),
    severity: normalizedSeverity,
    workspaceId: resolvedWorkspaceId,
    planId: String(plan._id),
    remediationStatus: executionResult.status,
    executedActions: executionResult.executedActions,
    failedActions: executionResult.failedActions,
    actions: executionResult.actions,
  };
}

module.exports = {
  triggerSelfHealing,
};
