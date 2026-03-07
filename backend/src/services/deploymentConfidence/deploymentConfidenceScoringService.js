/* eslint-disable @typescript-eslint/no-require-imports */
const RepositoryAnalysis = require("../../models/RepositoryAnalysis");
const PipelineMetrics = require("../../models/PipelineMetrics");
const TechnicalDebtReport = require("../../models/TechnicalDebtReport");
const FailurePredictionResult = require("../../models/FailurePredictionResult");
const CostPrediction = require("../../models/CostPrediction");
const DeploymentConfidenceScore = require("../../models/DeploymentConfidenceScore");

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

// Weights for each signal (confirmed in requirements)
const SIGNAL_WEIGHTS = {
  testCoverage: 0.25,
  pipelineSuccessRate: 0.2,
  securityScanResults: 0.2,
  failurePredictionScore: 0.25,
  costRiskScore: 0.1,
};

function determineRiskLevel(score) {
  if (score >= 85) return "SAFE_TO_DEPLOY";
  if (score >= 70) return "LOW_RISK";
  if (score >= 55) return "MEDIUM_RISK";
  if (score >= 40) return "HIGH_RISK";
  return "CRITICAL_RISK";
}

function generateRecommendations(signals) {
  const recommendations = [];

  // Test Coverage Recommendations
  if (signals.testCoverage < 60) {
    recommendations.push({
      priority: "CRITICAL",
      message: "Test coverage is critically low (<60%). Add unit and integration tests before deployment.",
    });
  } else if (signals.testCoverage < 75) {
    recommendations.push({
      priority: "HIGH",
      message: "Test coverage below best practice (75%). Improve test coverage to increase confidence.",
    });
  }

  // Pipeline Success Rate Recommendations
  if (signals.pipelineSuccessRate < 80) {
    recommendations.push({
      priority: "HIGH",
      message: "Pipeline success rate is below 80%. Investigate recent failures and stabilize the pipeline.",
    });
  } else if (signals.pipelineSuccessRate < 95) {
    recommendations.push({
      priority: "MEDIUM",
      message: "Pipeline success rate could be improved (>95% is ideal). Review recent failed builds.",
    });
  }

  // Security Recommendations
  if (signals.securityScore < 60) {
    recommendations.push({
      priority: "CRITICAL",
      message: "Security score is critically low. Address all critical and high-severity vulnerabilities.",
    });
  } else if (signals.securityScore < 75) {
    recommendations.push({
      priority: "HIGH",
      message: "Security concerns detected. Review and remediate identified vulnerabilities.",
    });
  }

  // Failure Prediction Recommendations
  const failureProbability = signals.failurePredictionScore;
  if (failureProbability > 0.5) {
    recommendations.push({
      priority: "HIGH",
      message: `High failure probability predicted (${(failureProbability * 100).toFixed(1)}%). Consider delayed deployment or mitigation actions.`,
    });
  } else if (failureProbability > 0.3) {
    recommendations.push({
      priority: "MEDIUM",
      message: `Moderate failure risk detected (${(failureProbability * 100).toFixed(1)}%). Monitor deployment closely.`,
    });
  }

  // Cost Risk Recommendations
  if (signals.costRiskScore > 0.7) {
    recommendations.push({
      priority: "HIGH",
      message: "Deployment cost risk is high. Review infrastructure scaling assumptions.",
    });
  } else if (signals.costRiskScore > 0.5) {
    recommendations.push({
      priority: "MEDIUM",
      message: "Cost risk is moderate. Monitor resource utilization during and after deployment.",
    });
  }

  // Success case
  if (recommendations.length === 0) {
    recommendations.push({
      priority: "LOW",
      message: "All metrics are healthy. Deployment is well-prepared.",
    });
  }

  return recommendations;
}

function calculateConfidenceScore(signals) {
  // Formula from requirements:
  // confidenceScore = (testCoverage * 0.25) + (pipelineSuccessRate * 0.20) +
  //                   (securityScore * 0.20) + ((1 - failureProbability) * 0.25) +
  //                   ((1 - costRisk) * 0.10)
  //
  // All inputs are normalized to 0-1 or 0-100, then scaled to 0-100 for final score

  const testCoverageNormalized = normalizeNumber(signals.testCoverage, 50) / 100;
  const pipelineSuccessNormalized = normalizeNumber(signals.pipelineSuccessRate, 80) / 100;
  const securityScoreNormalized = normalizeNumber(signals.securityScore, 60) / 100;
  const failureProbability = normalizeNumber(signals.failurePredictionScore, 0.3);
  const costRiskNormalized = normalizeNumber(signals.costRiskScore, 0.5);

  const contributions = {
    testCoverageContribution: round2(testCoverageNormalized * SIGNAL_WEIGHTS.testCoverage * 100),
    pipelineSuccessContribution: round2(
      pipelineSuccessNormalized * SIGNAL_WEIGHTS.pipelineSuccessRate * 100
    ),
    securityContribution: round2(securityScoreNormalized * SIGNAL_WEIGHTS.securityScanResults * 100),
    failurePredictionContribution: round2(
      (1 - failureProbability) * SIGNAL_WEIGHTS.failurePredictionScore * 100
    ),
    costRiskContribution: round2((1 - costRiskNormalized) * SIGNAL_WEIGHTS.costRiskScore * 100),
  };

  const score = round2(
    testCoverageNormalized * SIGNAL_WEIGHTS.testCoverage * 100 +
      pipelineSuccessNormalized * SIGNAL_WEIGHTS.pipelineSuccessRate * 100 +
      securityScoreNormalized * SIGNAL_WEIGHTS.securityScanResults * 100 +
      (1 - failureProbability) * SIGNAL_WEIGHTS.failurePredictionScore * 100 +
      (1 - costRiskNormalized) * SIGNAL_WEIGHTS.costRiskScore * 100
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    contributions,
  };
}

function determineReleaseReadiness(signals) {
  return {
    testCoverageReady: signals.testCoverage >= 70,
    pipelineHealthy: signals.pipelineSuccessRate >= 85,
    secureForRelease: signals.securityScore >= 75,
    lowFailureRisk: signals.failurePredictionScore <= 0.4,
    acceptableCost: signals.costRiskScore <= 0.6,
  };
}

async function gatherInputSignals(repositoryId, workspaceId) {
  let testCoverage = 50;
  let pipelineSuccessRate = 80;
  let securityScore = 60;
  let failurePredictionScore = 0.3;
  let costRiskScore = 0.5;

  // Fetch Repository Analysis for test coverage
  try {
    const analysis = await RepositoryAnalysis.findOne({ repositoryId })
      .sort({ analysisTimestamp: -1 })
      .lean();
    if (analysis && analysis.testCoverage !== undefined) {
      testCoverage = normalizeNumber(analysis.testCoverage, 50);
    }
  } catch (err) {
    console.warn("Failed to fetch RepositoryAnalysis:", err.message);
  }

  // Fetch Pipeline Metrics for success rate
  try {
    const pipelineMetrics = await PipelineMetrics.findOne({ repositoryId })
      .sort({ timestamp: -1 })
      .lean();
    if (pipelineMetrics && pipelineMetrics.successRate !== undefined) {
      pipelineSuccessRate = normalizeNumber(pipelineMetrics.successRate * 100, 80);
    }
  } catch (err) {
    console.warn("Failed to fetch PipelineMetrics:", err.message);
  }

  // Fetch Technical Debt Report for security score
  try {
    const debtReport = await TechnicalDebtReport.findOne({ repositoryId })
      .sort({ timestamp: -1 })
      .lean();
    if (debtReport) {
      const totalIssues = normalizeNumber(debtReport.totalSecurityIssues, 0);
      const criticalIssues = normalizeNumber(debtReport.criticalIssues, 0);
      const securityPenalty = (criticalIssues * 15 + (totalIssues - criticalIssues) * 3);
      securityScore = Math.max(0, 100 - securityPenalty);
    }
  } catch (err) {
    console.warn("Failed to fetch TechnicalDebtReport:", err.message);
  }

  // Fetch Failure Prediction Score
  try {
    const failurePrediction = await FailurePredictionResult.findOne({ repositoryId })
      .sort({ timestamp: -1 })
      .lean();
    if (failurePrediction && failurePrediction.failureProbability !== undefined) {
      failurePredictionScore = normalizeNumber(failurePrediction.failureProbability, 0.3);
    }
  } catch (err) {
    console.warn("Failed to fetch FailurePredictionResult:", err.message);
  }

  // Fetch Cost Prediction for cost risk assessment
  try {
    const costPrediction = await CostPrediction.findOne({ repositoryId, workspaceId })
      .sort({ generatedAt: -1 })
      .lean();
    if (costPrediction && costPrediction.spikeCostEstimate !== undefined) {
      const monthlyCost = normalizeNumber(costPrediction.monthlyCostEstimate, 1000);
      const spikeCost = normalizeNumber(costPrediction.spikeCostEstimate, 2000);
      const costRatio = spikeCost / (monthlyCost || 1);
      costRiskScore = Math.min(1, costRatio / 5);
    }
  } catch (err) {
    console.warn("Failed to fetch CostPrediction:", err.message);
  }

  return {
    testCoverage: Math.min(100, Math.max(0, testCoverage)),
    pipelineSuccessRate: Math.min(100, Math.max(0, pipelineSuccessRate)),
    securityScore: Math.min(100, Math.max(0, securityScore)),
    failurePredictionScore: Math.min(1, Math.max(0, failurePredictionScore)),
    costRiskScore: Math.min(1, Math.max(0, costRiskScore)),
  };
}

async function calculateDeploymentConfidence({
  repositoryId,
  workspaceId,
  signals = null,
} = {}) {
  if (!repositoryId || !workspaceId) {
    const err = new Error("repositoryId and workspaceId are required");
    err.status = 400;
    throw err;
  }

  // Gather signals from existing systems or use provided signals
  const inputSignals = signals || (await gatherInputSignals(repositoryId, workspaceId));

  // Calculate confidence score and contributions
  const { score: confidenceScore, contributions: weightedContributions } =
    calculateConfidenceScore(inputSignals);

  // Determine risk level
  const riskLevel = determineRiskLevel(confidenceScore);

  // Determine release readiness
  const releaseReadiness = determineReleaseReadiness(inputSignals);

  // Generate recommendations
  const recommendations = generateRecommendations(inputSignals);

  // Create deployment confidence score document
  const scoreDoc = {
    repositoryId,
    workspaceId,
    confidenceScore: round2(confidenceScore),
    riskLevel,
    inputSignals,
    weightedContributions,
    recommendations,
    releaseReadiness,
    evaluatedAt: new Date(),
  };

  // Save to database
  const saved = await DeploymentConfidenceScore.create(scoreDoc);

  return {
    scoreId: String(saved._id),
    confidenceScore: round2(confidenceScore),
    riskLevel,
    inputSignals,
    weightedContributions,
    recommendations,
    releaseReadiness,
    evaluatedAt: saved.evaluatedAt,
  };
}

async function getDeploymentConfidenceHistory(repositoryId, limit = 10) {
  const scores = await DeploymentConfidenceScore.find({ repositoryId })
    .sort({ evaluatedAt: -1 })
    .limit(limit)
    .lean();

  return scores;
}

async function approveDeployment(scoreId, userId) {
  const score = await DeploymentConfidenceScore.findByIdAndUpdate(
    scoreId,
    {
      deploymentApprovedAt: new Date(),
      approvedBy: userId,
    },
    { new: true }
  );

  if (!score) {
    const err = new Error("Deployment confidence score not found");
    err.status = 404;
    throw err;
  }

  return score;
}

module.exports = {
  calculateDeploymentConfidence,
  getDeploymentConfidenceHistory,
  approveDeployment,
};
