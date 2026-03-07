/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  createRemediationPlan,
  approveRemediationPlan,
  executeRemediationPlan,
  getRemediationPlanById,
  getRemediationPlansForRepository,
} = require("../services/autonomousAgent/remediationPlannerService");

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

async function planRemediationsFromFailurePrediction(req, res) {
  try {
    const { repositoryId, failurePrediction, automationEnabled } = req.body;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    if (!failurePrediction) {
      return res.status(400).json({
        error: "validation_error",
        message: "failurePrediction data is required",
      });
    }

    const userId = req.auth.sub;
    const repository = await ensureRepositoryAccess(repositoryId, userId, "run_simulation");

    const plan = await createRemediationPlan({
      repositoryId,
      workspaceId: repository.workspaceId,
      triggeredBy: "failure_prediction",
      triggerContext: {
        detectionType: "failure_prediction",
        failurePrediction,
      },
      userId,
      automationEnabled: Boolean(automationEnabled),
    });

    return res.status(201).json({
      message: "Remediation plan created from failure prediction",
      planId: String(plan._id),
      status: plan.status,
      summary: plan.summary,
      actions: plan.actions.map((action) => ({
        agentType: action.agentType,
        actionName: action.actionName,
        description: action.description,
        priority: action.priority,
      })),
      automationEnabled: plan.automationEnabled,
    });
  } catch (err) {
    return handleError(res, err, "Failed to create remediation plan");
  }
}

async function planRemediationsFromDigitalTwin(req, res) {
  try {
    const { repositoryId, twinPrediction, automationEnabled } = req.body;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    if (!twinPrediction) {
      return res.status(400).json({
        error: "validation_error",
        message: "twinPrediction data is required",
      });
    }

    const userId = req.auth.sub;
    const repository = await ensureRepositoryAccess(repositoryId, userId, "run_simulation");

    const plan = await createRemediationPlan({
      repositoryId,
      workspaceId: repository.workspaceId,
      triggeredBy: "digital_twin",
      triggerContext: {
        detectionType: "digital_twin",
        twinPrediction,
      },
      userId,
      automationEnabled: Boolean(automationEnabled),
    });

    return res.status(201).json({
      message: "Remediation plan created from digital twin simulation",
      planId: String(plan._id),
      status: plan.status,
      summary: plan.summary,
      actions: plan.actions.map((action) => ({
        agentType: action.agentType,
        actionName: action.actionName,
        description: action.description,
        priority: action.priority,
      })),
      automationEnabled: plan.automationEnabled,
    });
  } catch (err) {
    return handleError(res, err, "Failed to create remediation plan");
  }
}

async function approvePlan(req, res) {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        error: "validation_error",
        message: "planId is required",
      });
    }

    const userId = req.auth.sub;
    const plan = await approveRemediationPlan(planId, userId);

    return res.status(200).json({
      message: "Remediation plan approved",
      planId: String(plan._id),
      status: plan.status,
      approvedBy: plan.approvedBy,
      approvedAt: plan.approvedAt,
    });
  } catch (err) {
    return handleError(res, err, "Failed to approve remediation plan");
  }
}

async function executePlan(req, res) {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        error: "validation_error",
        message: "planId is required",
      });
    }

    const result = await executeRemediationPlan(planId);

    return res.status(200).json({
      message: "Remediation plan execution completed",
      ...result,
    });
  } catch (err) {
    return handleError(res, err, "Failed to execute remediation plan");
  }
}

async function getPlanDetails(req, res) {
  try {
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({
        error: "validation_error",
        message: "planId is required",
      });
    }

    const plan = await getRemediationPlanById(planId);

    return res.status(200).json({
      message: "Remediation plan retrieved",
      plan,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve remediation plan");
  }
}

async function listPlansForRepository(req, res) {
  try {
    const { repositoryId } = req.params;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    const userId = req.auth.sub;
    await ensureRepositoryAccess(repositoryId, userId, "view_dashboard");

    const plans = await getRemediationPlansForRepository(repositoryId);

    return res.status(200).json({
      message: "Remediation plans retrieved",
      repositoryId,
      count: plans.length,
      plans,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve remediation plans");
  }
}

module.exports = {
  planRemediationsFromFailurePrediction,
  planRemediationsFromDigitalTwin,
  approvePlan,
  executePlan,
  getPlanDetails,
  listPlansForRepository,
};
