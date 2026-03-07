/* eslint-disable @typescript-eslint/no-require-imports */
const PredictiveIntelligenceReport = require("../../models/PredictiveIntelligenceReport");
const { runDigitalTwinSimulation } = require("../digitalTwin/digitalTwinService");
const { predictFailure } = require("../failurePrediction/failurePredictionService");
const { predictCloudCost } = require("../costPrediction/costPredictionEngineService");
const { calculateDeploymentConfidence } = require("../deploymentConfidence/deploymentConfidenceScoringService");

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function extractRiskFactorsFromDigitalTwin(digitalTwinResult) {
  const riskFactors = [];

  if (digitalTwinResult.successProbability < 0.8) {
    riskFactors.push(`Low success probability: ${(digitalTwinResult.successProbability * 100).toFixed(1)}%`);
  }

  if (digitalTwinResult.averageLatency > 500) {
    riskFactors.push(`High latency under traffic: ${digitalTwinResult.averageLatency.toFixed(0)}ms`);
  }

  if (digitalTwinResult.peakMemory > 85) {
    riskFactors.push(`Memory utilization spike: ${digitalTwinResult.peakMemory.toFixed(1)}%`);
  }

  if (digitalTwinResult.cpuUtilization > 80) {
    riskFactors.push(`CPU bottleneck detected: ${digitalTwinResult.cpuUtilization.toFixed(1)}%`);
  }

  return riskFactors;
}

function extractServiceRisksFromFailurePrediction(failurePredictionResult) {
  const risks = [];

  if (failurePredictionResult.predictedFailures && Array.isArray(failurePredictionResult.predictedFailures)) {
    failurePredictionResult.predictedFailures.forEach((failure) => {
      risks.push({
        service: failure.service || "unknown",
        riskScore: normalizeNumber(failure.failureProbability, 0.5),
        reason: failure.reason || "Predicted failure during peak load",
      });
    });
  }

  return risks;
}

function buildFinalRiskReport(digitalTwin, failurePred, costPred, deploymentConf) {
  const detectedRisks = [];

  // Extract risks from digital twin
  const dtRiskFactors = extractRiskFactorsFromDigitalTwin(digitalTwin);
  dtRiskFactors.forEach((factor) => {
    detectedRisks.push({
      service: "infrastructure",
      riskType: "performance",
      severity: "medium",
      description: factor,
    });
  });

  // Extract risks from failure prediction
  const serviceRisks = extractServiceRisksFromFailurePrediction(failurePred);
  serviceRisks.forEach((risk) => {
    const severity = risk.riskScore > 0.6 ? "high" : risk.riskScore > 0.3 ? "medium" : "low";
    detectedRisks.push({
      service: risk.service,
      riskType: "failure_probability",
      severity,
      description: `${risk.reason} (Risk: ${(risk.riskScore * 100).toFixed(1)}%)`,
    });
  });

  // Extract cost-related risks
  if (costPred.spikeCostEstimate > costPred.monthlyCostEstimate * 2) {
    detectedRisks.push({
      service: "infrastructure",
      riskType: "cost",
      severity: "medium",
      description: `Spike cost ${((costPred.spikeCostEstimate / costPred.monthlyCostEstimate).toFixed(1))}x baseline cost`,
    });
  }

  // Map deployment confidence to risk
  const deploymentRiskLevel = deploymentConf.riskLevel;
  let deploymentRisk = "low";
  if (deploymentRiskLevel === "HIGH_RISK" || deploymentRiskLevel === "CRITICAL_RISK") {
    deploymentRisk = "high";
  } else if (deploymentRiskLevel === "MEDIUM_RISK") {
    deploymentRisk = "medium";
  }

  if (deploymentRisk !== "low") {
    detectedRisks.push({
      service: "deployment",
      riskType: "readiness",
      severity: deploymentRisk,
      description: `Deployment confidence is ${deploymentConf.riskLevel.replace(/_/g, " ").toLowerCase()}`,
    });
  }

  // Calculate overall risk score (0-1)
  const avgFailureRisk = failurePred.failureProbability || 0;
  const costRiskFactor = Math.min(1, (costPred.spikeCostEstimate / (costPred.monthlyCostEstimate * 5)) || 0);
  const deploymentConfRisk = 1 - (deploymentConf.confidenceScore / 100);
  const dtSuccessRisk = 1 - (digitalTwin.successProbability || 0.7);

  const overallRiskScore = round2((avgFailureRisk * 0.35 + costRiskFactor * 0.15 + deploymentConfRisk * 0.35 + dtSuccessRisk * 0.15));

  // Determine overall risk level
  let riskLevel = "LOW";
  if (overallRiskScore > 0.65) {
    riskLevel = "CRITICAL";
  } else if (overallRiskScore > 0.5) {
    riskLevel = "HIGH";
  } else if (overallRiskScore > 0.3) {
    riskLevel = "MEDIUM";
  }

  // Generate recommended actions
  const recommendedActions = [];

  // Actions from deployment confidence
  if (deploymentConf.recommendations && Array.isArray(deploymentConf.recommendations)) {
    deploymentConf.recommendations
      .filter((rec) => rec.priority !== "LOW")
      .forEach((rec) => {
        recommendedActions.push({
          priority: rec.priority,
          action: rec.message,
          impact: "deployment_readiness",
        });
      });
  }

  // Actions based on detected risks
  if (digitalTwin.averageLatency > 500) {
    recommendedActions.push({
      priority: "HIGH",
      action: "Implement caching strategy or optimize database queries to reduce latency",
      impact: "performance",
    });
  }

  if (digitalTwin.peakMemory > 85) {
    recommendedActions.push({
      priority: "HIGH",
      action: "Scale up memory allocation or optimize memory-intensive operations",
      impact: "stability",
    });
  }

  if (costPred.spikeCostEstimate > costPred.monthlyCostEstimate * 3) {
    recommendedActions.push({
      priority: "MEDIUM",
      action: "Review auto-scaling policies to prevent runaway costs during traffic spikes",
      impact: "cost_control",
    });
  }

  // Determine deployment readiness
  const blockers = [];
  const warnings = [];

  if (deploymentConf.riskLevel === "CRITICAL_RISK" || deploymentConf.riskLevel === "HIGH_RISK") {
    blockers.push(`Deployment confidence is in ${deploymentConf.riskLevel.replace(/_/g, " ").toLowerCase()}`);
  }

  if (avgFailureRisk > 0.5) {
    blockers.push(`High failure probability predicted (${(avgFailureRisk * 100).toFixed(1)}%)`);
  }

  if (digitalTwin.successProbability < 0.75) {
    warnings.push(`Digital twin simulation shows ${(digitalTwin.successProbability * 100).toFixed(1)}% success rate`);
  }

  if (costPred.spikeCostEstimate > costPred.monthlyCostEstimate * 2) {
    warnings.push("Significant cost differential between baseline and spike scenarios");
  }

  const isReady = blockers.length === 0;
  const readinessPercentage = Math.max(0, Math.min(100, 100 - detectedRisks.length * 15));

  return {
    overallRiskScore,
    riskLevel,
    detectedRisks,
    recommendedActions,
    deploymentReadiness: {
      isReady,
      readinessPercentage: round2(readinessPercentage),
      blockers,
      warnings,
    },
  };
}

async function orchestratePredictiveAnalysis({
  repositoryId,
  workspaceId,
  trafficScenario = "baseline",
} = {}) {
  if (!repositoryId || !workspaceId) {
    const err = new Error("repositoryId and workspaceId are required");
    err.status = 400;
    throw err;
  }

  const startTime = Date.now();
  const errorLog = [];

  // Create initial report document
  const report = await PredictiveIntelligenceReport.create({
    repositoryId,
    workspaceId,
    trafficScenario,
    orchestrationStatus: "in_progress",
    executionTimeline: {
      orchestrationStarted: new Date(),
    },
  });

  try {
    // Stage 1: Digital Twin Simulation
    let digitalTwinResult = null;
    try {
      digitalTwinResult = await runDigitalTwinSimulation({
        repositoryId,
        workspaceId,
        trafficScenario,
      });
      report.digitalTwinPrediction = {
        simulationId: digitalTwinResult.simulationId || null,
        successProbability: normalizeNumber(digitalTwinResult.successProbability, 0.7),
        averageLatency: normalizeNumber(digitalTwinResult.averageLatency, 150),
        peakMemory: normalizeNumber(digitalTwinResult.peakMemory, 60),
        cpuUtilization: normalizeNumber(digitalTwinResult.cpuUtilization, 50),
        estimatedResourceCost: normalizeNumber(digitalTwinResult.estimatedResourceCost, 500),
        riskFactors: extractRiskFactorsFromDigitalTwin(digitalTwinResult),
        timestamp: new Date(),
      };
      report.executionTimeline.digitalTwinCompleted = new Date();
    } catch (err) {
      console.warn("Digital twin simulation warning (using defaults):", err.message);
      errorLog.push({
        stage: "digitalTwinSimulation",
        error: err.message,
        timestamp: new Date(),
      });
      report.digitalTwinPrediction = {
        successProbability: 0.7,
        averageLatency: 150,
        peakMemory: 60,
        cpuUtilization: 50,
        estimatedResourceCost: 500,
        riskFactors: ["Unable to simulate digital twin"],
        timestamp: new Date(),
      };
      report.executionTimeline.digitalTwinCompleted = new Date();
    }

    // Stage 2: Failure Prediction
    let failurePredictionResult = null;
    try {
      failurePredictionResult = await predictFailure({
        repositoryId,
        workspaceId,
      });
      report.failurePrediction = {
        predictionId: failurePredictionResult.predictionId || null,
        failureProbability: normalizeNumber(failurePredictionResult.failureProbability, 0.2),
        riskFactors: extractServiceRisksFromFailurePrediction(failurePredictionResult),
        timestamp: new Date(),
      };
      report.executionTimeline.failurePredictionCompleted = new Date();
    } catch (err) {
      console.warn("Failure prediction warning (using defaults):", err.message);
      errorLog.push({
        stage: "failurePrediction",
        error: err.message,
        timestamp: new Date(),
      });
      report.failurePrediction = {
        failureProbability: 0.2,
        riskFactors: [],
        timestamp: new Date(),
      };
      report.executionTimeline.failurePredictionCompleted = new Date();
    }

    // Stage 3: Cost Prediction
    let costPredictionResult = null;
    try {
      costPredictionResult = await predictCloudCost({
        repositoryId,
        workspaceId,
        trafficSpikeFactor: trafficScenario === "spike" ? 5 : trafficScenario === "peak" ? 3 : 1,
      });
      report.costPrediction = {
        predictionId: costPredictionResult.predictionId || null,
        monthlyCostEstimate: normalizeNumber(costPredictionResult.monthlyCostEstimate, 500),
        spikeCostEstimate: normalizeNumber(costPredictionResult.spikeCostEstimate, 1200),
        costBreakdown: {
          compute: normalizeNumber(costPredictionResult.costBreakdown?.baseline?.compute, 300),
          storage: normalizeNumber(costPredictionResult.costBreakdown?.baseline?.storage, 150),
          network: normalizeNumber(costPredictionResult.costBreakdown?.baseline?.network, 50),
        },
        timestamp: new Date(),
      };
      report.executionTimeline.costPredictionCompleted = new Date();
    } catch (err) {
      console.warn("Cost prediction warning (using defaults):", err.message);
      errorLog.push({
        stage: "costPrediction",
        error: err.message,
        timestamp: new Date(),
      });
      report.costPrediction = {
        monthlyCostEstimate: 500,
        spikeCostEstimate: 1200,
        costBreakdown: {
          compute: 300,
          storage: 150,
          network: 50,
        },
        timestamp: new Date(),
      };
      report.executionTimeline.costPredictionCompleted = new Date();
    }

    // Stage 4: Deployment Confidence Scoring
    let deploymentConfidenceResult = null;
    try {
      deploymentConfidenceResult = await calculateDeploymentConfidence({
        repositoryId,
        workspaceId,
      });
      report.deploymentConfidence = {
        scoreId: deploymentConfidenceResult.scoreId || null,
        confidenceScore: normalizeNumber(deploymentConfidenceResult.confidenceScore, 70),
        riskLevel: deploymentConfidenceResult.riskLevel || "MEDIUM_RISK",
        recommendations: deploymentConfidenceResult.recommendations || [],
        timestamp: new Date(),
      };
      report.executionTimeline.deploymentConfidenceCompleted = new Date();
    } catch (err) {
      console.warn("Deployment confidence warning (using defaults):", err.message);
      errorLog.push({
        stage: "deploymentConfidence",
        error: err.message,
        timestamp: new Date(),
      });
      report.deploymentConfidence = {
        confidenceScore: 70,
        riskLevel: "MEDIUM_RISK",
        recommendations: [],
        timestamp: new Date(),
      };
      report.executionTimeline.deploymentConfidenceCompleted = new Date();
    }

    // Stage 5: Build Final Risk Report
    try {
      report.finalRiskReport = buildFinalRiskReport(
        report.digitalTwinPrediction,
        report.failurePrediction,
        report.costPrediction,
        report.deploymentConfidence
      );
    } catch (err) {
      console.error("Failed to build final risk report:", err.message);
      errorLog.push({
        stage: "buildFinalRiskReport",
        error: err.message,
        timestamp: new Date(),
      });
      throw err;
    }

    // Mark as completed
    report.orchestrationStatus = "completed";
    report.executionTimeline.orchestrationCompleted = new Date();
    report.executionTimeline.totalDurationMs = Date.now() - startTime;
    report.errorLog = errorLog;

    await report.save();

    return {
      reportId: String(report._id),
      repositoryId: String(report.repositoryId),
      workspaceId: String(report.workspaceId),
      trafficScenario: report.trafficScenario,
      orchestrationStatus: report.orchestrationStatus,
      digitalTwinPrediction: report.digitalTwinPrediction,
      failurePrediction: report.failurePrediction,
      costPrediction: report.costPrediction,
      deploymentConfidence: report.deploymentConfidence,
      finalRiskReport: report.finalRiskReport,
      executionTimeline: report.executionTimeline,
      errorLog: report.errorLog,
    };
  } catch (err) {
    report.orchestrationStatus = "failed";
    report.errorLog = errorLog;
    await report.save();
    throw err;
  }
}

async function getPredictiveAnalysisHistory(repositoryId, limit = 10) {
  const reports = await PredictiveIntelligenceReport.find({ repositoryId })
    .sort({ generatedAt: -1 })
    .limit(limit)
    .lean();

  return reports;
}

module.exports = {
  orchestratePredictiveAnalysis,
  getPredictiveAnalysisHistory,
};
