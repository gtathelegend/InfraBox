/* eslint-disable @typescript-eslint/no-require-imports */
const SimulationResult = require("../../models/SimulationResult");

const DEFAULT_CPU_THRESHOLD = 80;
const DEFAULT_LATENCY_THRESHOLD = 1000;
const DEFAULT_ERROR_RATE_THRESHOLD = 5;

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pushIssue(state, issue, recommendation, points) {
  state.detectedIssues.push(issue);
  state.recommendations.add(recommendation);
  state.riskScore += points;
}

function getRiskLevel(score) {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function analyzeInfrastructureBehavior(metrics, options = {}) {
  const cpuThreshold = normalizeNumber(options.cpuThreshold, DEFAULT_CPU_THRESHOLD);
  const latencyThreshold = normalizeNumber(options.latencyThreshold, DEFAULT_LATENCY_THRESHOLD);
  const errorRateThreshold = normalizeNumber(
    options.errorRateThreshold,
    DEFAULT_ERROR_RATE_THRESHOLD
  );
  const containerLimit = options.containerLimit;

  const cpuUsage = normalizeNumber(metrics.cpuUsage);
  const memoryUsage = normalizeNumber(metrics.memoryUsage);
  const latency = normalizeNumber(metrics.latency);
  const errorRate = normalizeNumber(metrics.errorRate);

  const state = {
    riskScore: 0,
    detectedIssues: [],
    recommendations: new Set(),
  };

  if (cpuUsage > cpuThreshold) {
    pushIssue(
      state,
      `High CPU risk: cpuUsage (${cpuUsage}%) exceeds threshold (${cpuThreshold}%)`,
      "Increase container replicas and optimize CPU-intensive tasks.",
      30
    );
  }

  if (containerLimit !== undefined && containerLimit !== null) {
    const numericContainerLimit = normalizeNumber(containerLimit, -1);
    if (numericContainerLimit >= 0 && memoryUsage > numericContainerLimit) {
      pushIssue(
        state,
        `Memory risk: memoryUsage (${memoryUsage}) exceeds containerLimit (${numericContainerLimit})`,
        "Increase container memory limit and optimize memory usage.",
        35
      );
    }
  }

  if (latency > latencyThreshold) {
    pushIssue(
      state,
      `Latency risk: latency (${latency}ms) exceeds threshold (${latencyThreshold}ms)`,
      "Optimize request path and scale the service under high load.",
      20
    );
  }

  if (errorRate > errorRateThreshold) {
    pushIssue(
      state,
      `Reliability risk: errorRate (${errorRate}%) exceeds threshold (${errorRateThreshold}%)`,
      "Investigate failing stages and add retries/circuit breakers for unstable dependencies.",
      25
    );
  }

  const normalizedRiskScore = Math.min(100, Math.round(state.riskScore));

  return {
    riskLevel: getRiskLevel(normalizedRiskScore),
    riskScore: normalizedRiskScore,
    detectedIssues: state.detectedIssues,
    recommendations: Array.from(state.recommendations),
    analyzedMetrics: {
      cpuUsage,
      memoryUsage,
      latency,
      errorRate,
      containerLimit,
      cpuThreshold,
      latencyThreshold,
      errorRateThreshold,
    },
  };
}

async function resolveSimulationMetrics({ simulationResultId, repositoryId, metrics }) {
  if (metrics) {
    return metrics;
  }

  if (simulationResultId) {
    const result = await SimulationResult.findById(simulationResultId);
    if (!result) {
      const err = new Error("Simulation result not found");
      err.status = 404;
      throw err;
    }

    return {
      cpuUsage: result.cpuUsage,
      memoryUsage: result.memoryUsage,
      latency: result.latency,
      errorRate: result.errorRate,
      repositoryId: result.repositoryId,
    };
  }

  if (repositoryId) {
    const latestResult = await SimulationResult.findOne({ repositoryId }).sort({ timestamp: -1 });

    if (!latestResult) {
      const err = new Error("No simulation results found for this repository");
      err.status = 404;
      throw err;
    }

    return {
      cpuUsage: latestResult.cpuUsage,
      memoryUsage: latestResult.memoryUsage,
      latency: latestResult.latency,
      errorRate: latestResult.errorRate,
      repositoryId: latestResult.repositoryId,
    };
  }

  const err = new Error(
    "Provide metrics directly, or pass simulationResultId/repositoryId to analyze stored results"
  );
  err.status = 400;
  throw err;
}

module.exports = {
  analyzeInfrastructureBehavior,
  resolveSimulationMetrics,
};
