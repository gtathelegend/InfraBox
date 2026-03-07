/* eslint-disable @typescript-eslint/no-require-imports */
const {
  getPipelineInsights,
  getFailureAnalysis,
  getCostOptimizationInsights,
  getDeploymentStatus,
  getInfrastructureHealth,
  getComprehensiveAnalysis,
} = require("./devopsKnowledgeService");

// Intent-to-data-source mapping
const INTENT_DATA_MAP = {
  deployment_failure: ["deploymentStatus", "failureAnalysis", "pipelineInsights"],
  performance_issue: ["infrastructureHealth", "pipelineInsights", "failureAnalysis"],
  cost_optimization: ["costInsights", "infrastructureHealth"],
  pipeline_analysis: ["pipelineInsights", "failureAnalysis"],
  general_devops_question: [
    "infrastructureHealth",
    "deploymentStatus",
    "pipelineInsights",
    "costInsights",
  ],
  // Backward-compatible aliases
  deployment_failures: ["deploymentStatus", "failureAnalysis", "pipelineInsights"],
  performance: ["infrastructureHealth", "pipelineInsights", "failureAnalysis"],
  general_infrastructure: [
    "infrastructureHealth",
    "deploymentStatus",
    "pipelineInsights",
    "costInsights",
  ],
};

async function routeQuery({
  workspaceId,
  repositoryId = null,
  detectedIntent = "general_devops_question",
} = {}) {
  if (!workspaceId) {
    const err = new Error("workspaceId is required");
    err.status = 400;
    throw err;
  }

  // Determine which data sources to query based on intent
  const dataSources = INTENT_DATA_MAP[detectedIntent] || INTENT_DATA_MAP.general_devops_question;

  // Check if we need comprehensive analysis
  const needsComprehensive =
    detectedIntent === "general_devops_question" || dataSources.length > 3;

  if (needsComprehensive) {
    return await getComprehensiveAnalysis(workspaceId, repositoryId);
  }

  // Build selective query response
  const data = {
    workspaceId,
    intent: detectedIntent,
    dataSources,
    generatedAt: new Date(),
  };

  // Execute only necessary queries
  if (dataSources.includes("pipelineInsights")) {
    data.pipelineInsights = await getPipelineInsights(workspaceId, repositoryId);
  }

  if (dataSources.includes("failureAnalysis")) {
    data.failureAnalysis = await getFailureAnalysis(workspaceId, repositoryId);
  }

  if (dataSources.includes("costInsights")) {
    data.costInsights = await getCostOptimizationInsights(workspaceId, repositoryId);
  }

  if (dataSources.includes("deploymentStatus")) {
    data.deploymentStatus = await getDeploymentStatus(workspaceId, repositoryId);
  }

  if (dataSources.includes("infrastructureHealth")) {
    data.infrastructureHealth = await getInfrastructureHealth(workspaceId);
  }

  return data;
}

function synthesizeContext(knowledge) {
  const context = [];

  if (knowledge.pipelineInsights) {
    const pipe = knowledge.pipelineInsights;
    if (pipe.summary) {
      if (pipe.summary.totalPipelines > 0) {
        context.push(
          `Pipeline Status: ${pipe.overallStatus} (${pipe.summary.averageSuccessRate}% success rate)`
        );
        if (pipe.summary.slowestStage) {
          context.push(
            `Slowest Stage: ${pipe.summary.slowestStage} (${pipe.summary.slowestStageDuration})`
          );
        }
      }
    }
  }

  if (knowledge.failureAnalysis) {
    const fail = knowledge.failureAnalysis;
    if (fail.summary && fail.summary.totalAnalyses > 0) {
      context.push(`Failure Risk: ${fail.overallRiskLevel} (${fail.summary.averageFailureProbability}% probability)`);
      if (fail.summary.criticalServices && fail.summary.criticalServices.length > 0) {
        const criticalList = fail.summary.criticalServices
          .slice(0, 2)
          .map((s) => s.service)
          .join(", ");
        context.push(`Critical Risk Services: ${criticalList}`);
      }
    }
  }

  if (knowledge.costInsights) {
    const cost = knowledge.costInsights;
    if (cost.summary) {
      context.push(`Monthly Cost: $${cost.summary.averageMonthlyCost}`);
      if (cost.summary.spikeRatio > 2) {
        context.push(`Spike Cost Ratio: ${cost.summary.spikeRatio}x (High variability)`);
      }
    }
  }

  if (knowledge.deploymentStatus) {
    const deploy = knowledge.deploymentStatus;
    if (deploy.summary) {
      context.push(
        `Deployment Readiness: ${deploy.summary.overallReadiness}% (Risk: ${deploy.summary.riskLevel})`
      );
      if (deploy.summary.blockers && deploy.summary.blockers.length > 0) {
        context.push(`Deployment Blockers: ${deploy.summary.blockers.length}`);
      }
    }
  }

  if (knowledge.infrastructureHealth) {
    const infra = knowledge.infrastructureHealth;
    if (infra.status) {
      context.push(`Infrastructure Status: ${infra.status}`);
      if (infra.components) {
        if (infra.components.cpu?.status === "critical") {
          context.push(`CPU Usage: ${infra.components.cpu.average}% (CRITICAL)`);
        }
        if (infra.components.memory?.status === "critical") {
          context.push(`Memory Usage: ${infra.components.memory.average}% (CRITICAL)`);
        }
      }
    }
  }

  return context.join(" | ");
}

function extractKeyMetrics(knowledge) {
  const metrics = {};

  if (knowledge.pipelineInsights?.summary) {
    metrics.pipeline = {
      successRate: knowledge.pipelineInsights.summary.averageSuccessRate,
      executionTime: knowledge.pipelineInsights.summary.averageTotalExecutionTime,
      slowestStage: knowledge.pipelineInsights.summary.slowestStage,
    };
  }

  if (knowledge.failureAnalysis?.summary) {
    metrics.failures = {
      riskLevel: knowledge.failureAnalysis.overallRiskLevel,
      probability: knowledge.failureAnalysis.summary.averageFailureProbability,
      affectedServices: knowledge.failureAnalysis.summary.affectedServices,
    };
  }

  if (knowledge.costInsights?.summary) {
    metrics.costs = {
      monthly: knowledge.costInsights.summary.averageMonthlyCost,
      spike: knowledge.costInsights.summary.averageSpikeCost,
      provider: knowledge.costInsights.summary.provider,
    };
  }

  if (knowledge.deploymentStatus?.summary) {
    metrics.deployment = {
      readiness: knowledge.deploymentStatus.summary.overallReadiness,
      riskLevel: knowledge.deploymentStatus.summary.riskLevel,
      componentsReady: knowledge.deploymentStatus.summary.componentsReady,
    };
  }

  if (knowledge.infrastructureHealth?.components) {
    metrics.infrastructure = {
      status: knowledge.infrastructureHealth.status,
      cpu: knowledge.infrastructureHealth.components.cpu?.average,
      memory: knowledge.infrastructureHealth.components.memory?.average,
      latency: knowledge.infrastructureHealth.components.latency?.average,
    };
  }

  return metrics;
}

function buildInsightSummary(knowledge) {
  const summary = {
    dataPoints: 0,
    keyIssues: [],
    keyOpportunities: [],
    recommendations: [],
  };

  if (knowledge.pipelineInsights?.pipelines) {
    summary.dataPoints += knowledge.pipelineInsights.pipelines.length;
  }

  if (knowledge.failureAnalysis?.serviceRisks) {
    const criticalRisks = knowledge.failureAnalysis.serviceRisks.filter((s) => s.riskScore > 50);
    if (criticalRisks.length > 0) {
      summary.keyIssues.push({
        type: "failure_risk",
        severity: "high",
        description: `${criticalRisks.length} services at high failure risk`,
        services: criticalRisks.map((s) => s.service),
      });
    }
  }

  if (knowledge.costInsights?.recommendations) {
    const criticalCostIssues = knowledge.costInsights.recommendations.filter(
      (r) => r.priority === "critical"
    );
    if (criticalCostIssues.length > 0) {
      summary.keyIssues.push({
        type: "cost_control",
        severity: "high",
        description: `${criticalCostIssues.length} critical cost optimization opportunities`,
        potentialSavings: criticalCostIssues.reduce((sum, r) => sum + (r.potentialSavings || 0), 0),
      });
    }
    summary.recommendations.push(...knowledge.costInsights.recommendations.slice(0, 3));
  }

  if (knowledge.deploymentStatus?.summary?.blockers) {
    if (knowledge.deploymentStatus.summary.blockers.length > 0) {
      summary.keyIssues.push({
        type: "deployment_blocker",
        severity: "critical",
        description: `${knowledge.deploymentStatus.summary.blockers.length} deployment blockers`,
        blockers: knowledge.deploymentStatus.summary.blockers,
      });
    }
  }

  if (knowledge.pipelineInsights?.summary?.slowestStage) {
    summary.keyOpportunities.push({
      type: "performance_optimization",
      area: knowledge.pipelineInsights.summary.slowestStage,
      description: `${knowledge.pipelineInsights.summary.slowestStage} stage takes ${knowledge.pipelineInsights.summary.slowestStageDuration}`,
    });
  }

  return summary;
}

module.exports = {
  routeQuery,
  synthesizeContext,
  extractKeyMetrics,
  buildInsightSummary,
};
