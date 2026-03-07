/* eslint-disable @typescript-eslint/no-require-imports */
const PipelineMetrics = require("../../models/PipelineMetrics");
const SimulationResult = require("../../models/SimulationResult");
const FailurePredictionResult = require("../../models/FailurePredictionResult");
const CostPrediction = require("../../models/CostPrediction");
const DeploymentConfidenceScore = require("../../models/DeploymentConfidenceScore");
const ResourceMetrics = require("../../models/ResourceMetrics");
const TechnicalDebtReport = require("../../models/TechnicalDebtReport");

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "unknown";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

async function getPipelineInsights(workspaceId, repositoryId = null) {
  const insights = {
    overallStatus: "healthy",
    pipelines: [],
    summary: {},
  };

  try {
    const query = { workspaceId };
    if (repositoryId) query.repositoryId = repositoryId;

    const pipelineMetrics = await PipelineMetrics.find(query)
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    if (pipelineMetrics.length === 0) {
      insights.summary = {
        message: "No pipeline data available",
        totalPipelines: 0,
      };
      return insights;
    }

    // Calculate aggregate statistics
    const successRates = pipelineMetrics.map((p) => normalizeNumber(p.successRate, 0.9));
    const buildTimes = pipelineMetrics.map((p) => normalizeNumber(p.averageBuildTime, 0));
    const testTimes = pipelineMetrics.map((p) => normalizeNumber(p.averageTestTime, 0));
    const deployTimes = pipelineMetrics.map((p) => normalizeNumber(p.averageDeployTime, 0));

    const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
    const avgBuildTime = buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length;
    const avgTestTime = testTimes.reduce((a, b) => a + b, 0) / testTimes.length;
    const avgDeployTime = deployTimes.reduce((a, b) => a + b, 0) / deployTimes.length;
    const totalTime = avgBuildTime + avgTestTime + avgDeployTime;

    // Determine overall status
    if (avgSuccessRate < 0.7) {
      insights.overallStatus = "critical";
    } else if (avgSuccessRate < 0.85) {
      insights.overallStatus = "warning";
    } else if (avgSuccessRate < 0.95) {
      insights.overallStatus = "degraded";
    }

    // Build pipeline details
    insights.pipelines = pipelineMetrics.map((p) => ({
      repositoryId: String(p.repositoryId),
      successRate: round2(normalizeNumber(p.successRate, 0.9) * 100),
      failureRate: round2((1 - normalizeNumber(p.successRate, 0.9)) * 100),
      buildTime: formatDuration(normalizeNumber(p.averageBuildTime)),
      testTime: formatDuration(normalizeNumber(p.averageTestTime)),
      deployTime: formatDuration(normalizeNumber(p.averageDeployTime)),
      totalTime: formatDuration(totalTime),
      failureReasons: p.failureReasons || [],
      lastRun: p.timestamp,
    }));

    // Identify slowest stages
    const stages = [
      { name: "build", time: avgBuildTime },
      { name: "test", time: avgTestTime },
      { name: "deploy", time: avgDeployTime },
    ];
    const slowestStage = stages.reduce((a, b) => (a.time > b.time ? a : b));

    insights.summary = {
      totalPipelines: pipelineMetrics.length,
      averageSuccessRate: round2(avgSuccessRate * 100),
      averageFailureRate: round2((1 - avgSuccessRate) * 100),
      averageTotalExecutionTime: formatDuration(totalTime),
      slowestStage: slowestStage.name,
      slowestStageDuration: formatDuration(slowestStage.time),
      status: insights.overallStatus,
    };
  } catch (err) {
    console.warn("Failed to retrieve pipeline insights:", err.message);
    insights.summary = { error: err.message };
  }

  return insights;
}

async function getFailureAnalysis(workspaceId, repositoryId = null) {
  const analysis = {
    overallRiskLevel: "low",
    serviceRisks: [],
    summary: {},
  };

  try {
    const query = { workspaceId };
    if (repositoryId) query.repositoryId = repositoryId;

    const predictions = await FailurePredictionResult.find(query)
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    if (predictions.length === 0) {
      analysis.summary = {
        message: "No failure prediction data available",
        totalAnalyses: 0,
      };
      return analysis;
    }

    // Aggregate failure probabilities
    const failureProbs = predictions.map((p) => normalizeNumber(p.failureProbability, 0));
    const avgFailureProb = failureProbs.reduce((a, b) => a + b, 0) / failureProbs.length;

    // Determine overall risk level
    if (avgFailureProb > 0.6) {
      analysis.overallRiskLevel = "critical";
    } else if (avgFailureProb > 0.45) {
      analysis.overallRiskLevel = "high";
    } else if (avgFailureProb > 0.25) {
      analysis.overallRiskLevel = "medium";
    } else if (avgFailureProb > 0.1) {
      analysis.overallRiskLevel = "low";
    }

    // Collect service-level risks
    const serviceRiskMap = {};

    predictions.forEach((pred) => {
      if (pred.predictedFailures && Array.isArray(pred.predictedFailures)) {
        pred.predictedFailures.forEach((failure) => {
          const service = failure.service || "unknown";
          if (!serviceRiskMap[service]) {
            serviceRiskMap[service] = {
              riskScores: [],
              reasons: [],
            };
          }
          serviceRiskMap[service].riskScores.push(normalizeNumber(failure.failureProbability, 0));
          if (failure.reason) {
            serviceRiskMap[service].reasons.push(failure.reason);
          }
        });
      }
    });

    analysis.serviceRisks = Object.entries(serviceRiskMap)
      .map(([service, data]) => ({
        service,
        riskScore: round2((data.riskScores.reduce((a, b) => a + b, 0) / data.riskScores.length) * 100),
        failureProbability: round2((data.riskScores.reduce((a, b) => a + b, 0) / data.riskScores.length) * 100),
        topReasons: [...new Set(data.reasons)].slice(0, 3),
      }))
      .sort((a, b) => b.riskScore - a.riskScore);

    analysis.summary = {
      totalAnalyses: predictions.length,
      averageFailureProbability: round2(avgFailureProb * 100),
      affectedServices: analysis.serviceRisks.length,
      overallRiskLevel: analysis.overallRiskLevel,
      criticalServices: analysis.serviceRisks.filter((s) => s.riskScore > 50),
      highRiskServices: analysis.serviceRisks.filter((s) => s.riskScore > 25),
    };
  } catch (err) {
    console.warn("Failed to retrieve failure analysis:", err.message);
    analysis.summary = { error: err.message };
  }

  return analysis;
}

async function getCostOptimizationInsights(workspaceId, repositoryId = null) {
  const insights = {
    recommendations: [],
    summary: {},
  };

  try {
    const query = { workspaceId };
    if (repositoryId) query.repositoryId = repositoryId;

    const costPredictions = await CostPrediction.find(query)
      .sort({ generatedAt: -1 })
      .limit(10)
      .lean();

    if (costPredictions.length === 0) {
      insights.summary = {
        message: "No cost data available",
        totalAnalyses: 0,
      };
      return insights;
    }

    const monthlyCosts = costPredictions.map((c) => normalizeNumber(c.monthlyCostEstimate, 0));
    const spikeCosts = costPredictions.map((c) => normalizeNumber(c.spikeCostEstimate, 0));

    const avgMonthlyCost = monthlyCosts.reduce((a, b) => a + b, 0) / monthlyCosts.length;
    const avgSpikeCost = spikeCosts.reduce((a, b) => a + b, 0) / spikeCosts.length;
    const maxMonthlyCost = Math.max(...monthlyCosts);
    const maxSpikeCost = Math.max(...spikeCosts);

    const spikeRatio = avgSpikeCost / (avgMonthlyCost || 1);
    const costVariability = (spikeRatio - 1) * 100;

    // Analyze cost breakdown
    const latest = costPredictions[0];
    const breakdown = latest.costBreakdown || {};

    insights.recommendations = [];

    if (spikeRatio > 3) {
      insights.recommendations.push({
        priority: "critical",
        area: "auto_scaling",
        recommendation: `Spike costs are ${spikeRatio.toFixed(1)}x baseline (${round2(avgSpikeCost)} vs ${round2(avgMonthlyCost)}). Implement cost controls for traffic spikes.`,
        potentialSavings: round2((spikeRatio - 2) * avgMonthlyCost),
      });
    }

    if (breakdown.compute > avgMonthlyCost * 0.6) {
      insights.recommendations.push({
        priority: "high",
        area: "compute_optimization",
        recommendation: "Compute costs consume >60% of budget. Review instance types and right-sizing opportunities.",
        potentialSavings: round2(avgMonthlyCost * 0.15),
      });
    }

    if (breakdown.network > avgMonthlyCost * 0.25) {
      insights.recommendations.push({
        priority: "medium",
        area: "network_optimization",
        recommendation: "Network costs are high. Consider CDN, caching, or data transfer optimization.",
        potentialSavings: round2(avgMonthlyCost * 0.1),
      });
    }

    if (breakdown.storage > avgMonthlyCost * 0.25) {
      insights.recommendations.push({
        priority: "medium",
        area: "storage_optimization",
        recommendation: "Storage costs are significant. Review retention policies and archive strategies.",
        potentialSavings: round2(avgMonthlyCost * 0.08),
      });
    }

    insights.summary = {
      totalAnalyses: costPredictions.length,
      averageMonthlyCost: round2(avgMonthlyCost),
      averageSpikeCost: round2(avgSpikeCost),
      maxMonthlyCost: round2(maxMonthlyCost),
      maxSpikeCost: round2(maxSpikeCost),
      costVariability: round2(costVariability),
      spikeRatio: round2(spikeRatio),
      costBreakdown: {
        compute: round2(breakdown.compute || 0),
        storage: round2(breakdown.storage || 0),
        network: round2(breakdown.network || 0),
      },
      provider: latest.provider || "generic",
      totalRecommendations: insights.recommendations.length,
      criticalRecommendations: insights.recommendations.filter((r) => r.priority === "critical").length,
    };
  } catch (err) {
    console.warn("Failed to retrieve cost insights:", err.message);
    insights.summary = { error: err.message };
  }

  return insights;
}

async function getDeploymentStatus(workspaceId, repositoryId = null) {
  const status = {
    overallReadiness: 0,
    components: [],
    summary: {},
  };

  try {
    const query = { workspaceId };
    if (repositoryId) query.repositoryId = repositoryId;

    const scores = await DeploymentConfidenceScore.find(query)
      .sort({ evaluatedAt: -1 })
      .limit(10)
      .lean();

    if (scores.length === 0) {
      status.summary = {
        message: "No deployment confidence data available",
        totalEvaluations: 0,
      };
      return status;
    }

    const confidenceScores = scores.map((s) => normalizeNumber(s.confidenceScore, 0));
    const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;

    const latest = scores[0];

    // Component status from release readiness
    if (latest.releaseReadiness) {
      status.components = [
        {
          name: "Test Coverage",
          ready: latest.releaseReadiness.testCoverageReady,
          score: latest.inputSignals?.testCoverage || 0,
        },
        {
          name: "Pipeline Health",
          ready: latest.releaseReadiness.pipelineHealthy,
          score: latest.inputSignals?.pipelineSuccessRate || 0,
        },
        {
          name: "Security",
          ready: latest.releaseReadiness.secureForRelease,
          score: latest.inputSignals?.securityScore || 0,
        },
        {
          name: "Failure Risk",
          ready: latest.releaseReadiness.lowFailureRisk,
          score: latest.inputSignals?.failurePredictionScore
            ? (1 - latest.inputSignals.failurePredictionScore) * 100
            : 0,
        },
        {
          name: "Cost Risk",
          ready: latest.releaseReadiness.acceptableCost,
          score: latest.inputSignals?.costRiskScore
            ? (1 - latest.inputSignals.costRiskScore) * 100
            : 0,
        },
      ];
    }

    const readyCount = status.components.filter((c) => c.ready).length;
    status.overallReadiness = round2((readyCount / (status.components.length || 1)) * 100);

    status.summary = {
      totalEvaluations: scores.length,
      averageConfidenceScore: round2(avgConfidence),
      latestConfidenceScore: latest.confidenceScore,
      overallReadiness: status.overallReadiness,
      riskLevel: latest.riskLevel,
      componentsReady: readyCount,
      totalComponents: status.components.length,
      recommendations: latest.recommendations || [],
      blockers: latest.releaseReadiness?.blockers || [],
      warnings: latest.releaseReadiness?.warnings || [],
    };
  } catch (err) {
    console.warn("Failed to retrieve deployment status:", err.message);
    status.summary = { error: err.message };
  }

  return status;
}

async function getInfrastructureHealth(workspaceId) {
  const health = {
    status: "unknown",
    components: {},
  };

  try {
    const query = { workspaceId };

    // Get recent metrics
    const recentMetrics = await ResourceMetrics.find(query)
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    if (recentMetrics.length === 0) {
      return health;
    }

    const cpuValues = recentMetrics.map((m) => normalizeNumber(m.cpuUsage, 0));
    const memoryValues = recentMetrics.map((m) => normalizeNumber(m.memoryUsage, 0));
    const latencyValues = recentMetrics.map((m) => normalizeNumber(m.latency, 0));
    const errorRates = recentMetrics.map((m) => normalizeNumber(m.errorRate, 0));

    const avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
    const avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
    const avgLatency = latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length;
    const avgErrorRate = errorRates.reduce((a, b) => a + b, 0) / errorRates.length;

    health.components = {
      cpu: {
        average: round2(avgCpu),
        status: avgCpu > 85 ? "critical" : avgCpu > 70 ? "warning" : "healthy",
      },
      memory: {
        average: round2(avgMemory),
        status: avgMemory > 85 ? "critical" : avgMemory > 70 ? "warning" : "healthy",
      },
      latency: {
        average: formatDuration(avgLatency),
        status: avgLatency > 2000 ? "critical" : avgLatency > 1000 ? "warning" : "healthy",
      },
      errorRate: {
        average: round2(avgErrorRate * 100),
        status: avgErrorRate > 0.05 ? "critical" : avgErrorRate > 0.01 ? "warning" : "healthy",
      },
    };

    const statusValues = Object.values(health.components).map((c) => c.status);
    if (statusValues.includes("critical")) {
      health.status = "critical";
    } else if (statusValues.includes("warning")) {
      health.status = "warning";
    } else {
      health.status = "healthy";
    }
  } catch (err) {
    console.warn("Failed to retrieve infrastructure health:", err.message);
  }

  return health;
}

async function getComprehensiveAnalysis(workspaceId, repositoryId = null) {
  const startTime = Date.now();

  const [
    pipelineInsights,
    failureAnalysis,
    costInsights,
    deploymentStatus,
    infrastructureHealth,
  ] = await Promise.all([
    getPipelineInsights(workspaceId, repositoryId),
    getFailureAnalysis(workspaceId, repositoryId),
    getCostOptimizationInsights(workspaceId, repositoryId),
    getDeploymentStatus(workspaceId, repositoryId),
    getInfrastructureHealth(workspaceId),
  ]);

  const executionTime = Date.now() - startTime;

  return {
    pipelineInsights,
    failureAnalysis,
    costInsights,
    deploymentStatus,
    infrastructureHealth,
    executionTime,
    generatedAt: new Date(),
  };
}

module.exports = {
  getPipelineInsights,
  getFailureAnalysis,
  getCostOptimizationInsights,
  getDeploymentStatus,
  getInfrastructureHealth,
  getComprehensiveAnalysis,
};
