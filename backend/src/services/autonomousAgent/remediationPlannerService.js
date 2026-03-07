/* eslint-disable @typescript-eslint/no-require-imports */
const RemediationPlan = require("../../models/RemediationPlan");

function selectAgentActions(context) {
  const actions = [];

  if (context.detectionType === "failure_prediction") {
    const prediction = context.failurePrediction || {};
    const riskLevel = prediction.riskLevel || "LOW";
    const reason = prediction.reason || "";

    if (riskLevel === "HIGH") {
      if (reason.includes("memory")) {
        actions.push({
          agentType: "healing",
          actionName: "clear_cache",
          description: "Clear cache to free memory immediately",
          priority: "high",
        });

        actions.push({
          agentType: "scaling",
          actionName: "adjust_resources",
          description: "Increase memory allocation for the service",
          priority: "high",
          parameters: {
            targetMemory: "2048Mi",
          },
        });
      } else if (reason.includes("cpu")) {
        actions.push({
          agentType: "scaling",
          actionName: "increase_replicas",
          description: "Scale up replicas to distribute CPU load",
          priority: "high",
        });
      } else if (reason.includes("latency") || reason.includes("error")) {
        actions.push({
          agentType: "healing",
          actionName: "restart_container",
          description: "Restart service to clear transient state",
          priority: "medium",
        });

        actions.push({
          agentType: "pipeline_optimization",
          actionName: "parallelize_stages",
          description: "Parallelize CI/CD stages to reduce deployment lag",
          priority: "medium",
        });
      }
    }

    if (riskLevel === "MEDIUM") {
      if (reason.includes("memory")) {
        actions.push({
          agentType: "cost_optimization",
          actionName: "adjust_auto_scaling",
          description: "Fine-tune auto-scaling for better resource utilization",
          priority: "medium",
        });
      }

      if (reason.includes("pipeline")) {
        actions.push({
          agentType: "pipeline_optimization",
          actionName: "cache_dependencies",
          description: "Enable dependency caching in CI/CD",
          priority: "low",
        });
      }
    }
  }

  if (context.detectionType === "digital_twin") {
    const prediction = context.twinPrediction || {};
    const riskIndicators = prediction.riskIndicators || {};
    const overallRisk = riskIndicators.overallRisk || "LOW";

    if (overallRisk === "HIGH") {
      actions.push({
        agentType: "scaling",
        actionName: "increase_replicas",
        description: "Proactively scale services under predicted heavy load",
        priority: "critical",
      });

      actions.push({
        agentType: "cost_optimization",
        actionName: "adjust_auto_scaling",
        description: "Adjust auto-scaling thresholds for predicted scenarios",
        priority: "high",
      });
    }
  }

  if (context.detectionType === "infrastructure_issues") {
    const issues = context.issues || [];

    for (const issue of issues) {
      if (issue.type === "idle_instances") {
        actions.push({
          agentType: "cost_optimization",
          actionName: "terminate_idle_instances",
          description: `Terminate ${issue.count || 1} idle instances`,
          priority: "medium",
          parameters: {
            idleInstanceCount: issue.count,
          },
        });
      }

      if (issue.type === "oversized_compute") {
        actions.push({
          agentType: "cost_optimization",
          actionName: "resize_compute",
          description: "Downsize compute instances",
          priority: "medium",
          parameters: {
            currentSize: issue.currentSize,
            newSize: issue.newSize,
          },
        });
      }
    }
  }

  return actions;
}

function buildRemediationSummary(actions) {
  if (!actions.length) return "No immediate actions recommended.";

  const actionsByAgent = {};
  for (const action of actions) {
    if (!actionsByAgent[action.agentType]) actionsByAgent[action.agentType] = [];
    actionsByAgent[action.agentType].push(action.actionName);
  }

  const descriptions = [];
  if (actionsByAgent.scaling) {
    descriptions.push(`Scale services: ${actionsByAgent.scaling.join(", ")}`);
  }
  if (actionsByAgent.healing) {
    descriptions.push(`Heal services: ${actionsByAgent.healing.join(", ")}`);
  }
  if (actionsByAgent.cost_optimization) {
    descriptions.push(`Optimize costs: ${actionsByAgent.cost_optimization.join(", ")}`);
  }
  if (actionsByAgent.pipeline_optimization) {
    descriptions.push(`Optimize pipeline: ${actionsByAgent.pipeline_optimization.join(", ")}`);
  }

  return descriptions.join(" | ");
}

async function planRemediations(context) {
  const actions = selectAgentActions(context);
  const summary = buildRemediationSummary(actions);

  return {
    actions,
    summary,
  };
}

async function createRemediationPlan({
  repositoryId,
  workspaceId,
  triggeredBy,
  triggerContext,
  userId,
  automationEnabled = false,
}) {
  if (!workspaceId) {
    const err = new Error("workspaceId is required");
    err.status = 400;
    throw err;
  }

  const context = {
    detectionType: triggeredBy === "failure_prediction" ? "failure_prediction" : "digital_twin",
    ...triggerContext,
  };

  const remediation = await planRemediations(context);

  const plan = await RemediationPlan.create({
    repositoryId: repositoryId || null,
    workspaceId,
    triggeredBy,
    triggerContext: context,
    status: "pending",
    actions: remediation.actions,
    summary: remediation.summary,
    automationEnabled,
    createdBy: userId,
  });

  return plan;
}

async function approveRemediationPlan(planId, userId) {
  const plan = await RemediationPlan.findById(planId);
  if (!plan) {
    const err = new Error("Remediation plan not found");
    err.status = 404;
    throw err;
  }

  if (plan.status !== "pending") {
    const err = new Error("Plan must be in pending status to approve");
    err.status = 400;
    throw err;
  }

  plan.status = "approved";
  plan.approvedBy = userId;
  plan.approvedAt = new Date();
  await plan.save();

  return plan;
}

async function executeRemediationPlan(planId) {
  const plan = await RemediationPlan.findById(planId);
  if (!plan) {
    const err = new Error("Remediation plan not found");
    err.status = 404;
    throw err;
  }

  if (plan.status !== "approved" && plan.status !== "pending") {
    const err = new Error("Plan must be in approved or pending status to execute");
    err.status = 400;
    throw err;
  }

  if (!plan.automationEnabled && plan.status !== "approved") {
    const err = new Error("Plan must be approved before execution unless automation is enabled");
    err.status = 400;
    throw err;
  }

  plan.status = "executing";
  plan.executionStartedAt = new Date();
  await plan.save();

  const executedActions = [];
  const failedActions = [];

  for (const action of plan.actions) {
    const actionDoc = plan.actions.id(action._id);

    try {
      actionDoc.status = "in_progress";
      await plan.save();

      const result = await executeAction({
        agentType: action.agentType,
        actionName: action.actionName,
        parameters: action.parameters || {},
      });

      actionDoc.status = result.success ? "completed" : "failed";
      actionDoc.result = result;
      actionDoc.executionLog = result.message || "";
      actionDoc.executedAt = new Date();

      if (result.success) {
        executedActions.push(action);
      } else {
        failedActions.push(action);
      }
    } catch (err) {
      actionDoc.status = "failed";
      actionDoc.executionLog = String(err.message || err);
      actionDoc.result = { error: String(err) };
      actionDoc.executedAt = new Date();

      failedActions.push(action);
    }

    await plan.save();
  }

  const hasFailures = failedActions.length > 0;
  plan.status = hasFailures && executedActions.length === 0 ? "failed" : "completed";
  plan.completedAt = new Date();
  await plan.save();

  return {
    planId: String(plan._id),
    status: plan.status,
    executedActions: executedActions.length,
    failedActions: failedActions.length,
    actions: plan.actions,
  };
}

async function getRemediationPlanById(planId) {
  const plan = await RemediationPlan.findById(planId);
  if (!plan) {
    const err = new Error("Remediation plan not found");
    err.status = 404;
    throw err;
  }

  return plan;
}

async function getRemediationPlansForRepository(repositoryId, limit = 50) {
  const plans = await RemediationPlan.find({ repositoryId })
    .sort({ createdAt: -1 })
    .limit(limit);

  return plans;
}

async function getRemediationPlansForWorkspace(workspaceId, limit = 50) {
  const plans = await RemediationPlan.find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(limit);

  return plans;
}

module.exports = {
  createRemediationPlan,
  approveRemediationPlan,
  executeRemediationPlan,
  getRemediationPlanById,
  getRemediationPlansForRepository,
  getRemediationPlansForWorkspace,
  planRemediations,
};
