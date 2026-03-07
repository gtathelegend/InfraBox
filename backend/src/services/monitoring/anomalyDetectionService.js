/* eslint-disable @typescript-eslint/no-require-imports */
const ServiceMetrics = require("../../models/ServiceMetrics");

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function baselineRatio(current, baseline) {
  const safeBaseline = baseline <= 0 ? 1 : baseline;
  return current / safeBaseline;
}

function calculateSeverity(findings) {
  if (!findings.length) return "none";

  let maxScore = 0;
  for (const finding of findings) {
    const score = normalizeNumber(finding.score, 0);
    if (score > maxScore) maxScore = score;
  }

  if (maxScore >= 2.5) return "critical";
  if (maxScore >= 1.8) return "high";
  if (maxScore >= 1.3) return "medium";
  return "low";
}

function buildImpact(findings) {
  if (!findings.length) return "no anomalous impact detected";

  const types = findings.map((item) => item.issueType);
  if (types.includes("memory_spike") && types.includes("error_spike")) {
    return "increased error rate likely caused by memory pressure";
  }
  if (types.includes("latency_spike") && types.includes("traffic_spike")) {
    return "traffic surge likely increasing response latency";
  }
  if (types.includes("cpu_spike")) {
    return "compute saturation may degrade request throughput";
  }

  return "runtime instability detected across monitored metrics";
}

function createThresholds(input = {}) {
  const containerLimit = normalizeNumber(input.containerLimit, 85);

  return {
    cpuUsage: normalizeNumber(input.cpuUsageThreshold, 85),
    memoryUsage: normalizeNumber(input.memoryUsageThreshold, containerLimit),
    latency: normalizeNumber(input.latencyThreshold, 1000),
    trafficSpikeMultiplier: normalizeNumber(input.trafficSpikeMultiplier, 2),
    errorSpikeMultiplier: normalizeNumber(input.errorSpikeMultiplier, 2),
  };
}

function detectFindings({ latest, baseline, thresholds }) {
  const findings = [];

  if (latest.cpuUsage > thresholds.cpuUsage) {
    findings.push({
      issueType: "cpu_spike",
      metric: "cpuUsage",
      currentValue: latest.cpuUsage,
      threshold: thresholds.cpuUsage,
      score: round2(latest.cpuUsage / thresholds.cpuUsage),
      message: `CPU anomaly detected: ${latest.cpuUsage}% > ${thresholds.cpuUsage}%`,
    });
  }

  if (latest.memoryUsage > thresholds.memoryUsage) {
    findings.push({
      issueType: "memory_spike",
      metric: "memoryUsage",
      currentValue: latest.memoryUsage,
      threshold: thresholds.memoryUsage,
      score: round2(latest.memoryUsage / thresholds.memoryUsage),
      message: `Memory anomaly detected: ${latest.memoryUsage}% > ${thresholds.memoryUsage}%`,
    });
  }

  if (latest.latency > thresholds.latency) {
    findings.push({
      issueType: "latency_spike",
      metric: "latency",
      currentValue: latest.latency,
      threshold: thresholds.latency,
      score: round2(latest.latency / thresholds.latency),
      message: `Latency anomaly detected: ${latest.latency}ms > ${thresholds.latency}ms`,
    });
  }

  const errorRatio = baselineRatio(latest.errorRate, baseline.errorRate || 0.5);
  if (errorRatio > thresholds.errorSpikeMultiplier) {
    findings.push({
      issueType: "error_spike",
      metric: "errorRate",
      currentValue: latest.errorRate,
      baseline: baseline.errorRate,
      threshold: round2((baseline.errorRate || 0.5) * thresholds.errorSpikeMultiplier),
      score: round2(errorRatio),
      message: `Error spike detected: ${latest.errorRate}% vs baseline ${round2(baseline.errorRate)}%`,
    });
  }

  const trafficRatio = baselineRatio(latest.traffic, baseline.traffic || 1);
  if (trafficRatio > thresholds.trafficSpikeMultiplier) {
    findings.push({
      issueType: "traffic_spike",
      metric: "traffic",
      currentValue: latest.traffic,
      baseline: baseline.traffic,
      threshold: round2((baseline.traffic || 1) * thresholds.trafficSpikeMultiplier),
      score: round2(trafficRatio),
      message: `Traffic spike detected: ${latest.traffic} vs baseline ${round2(baseline.traffic)}`,
    });
  }

  return findings;
}

async function runAnomalyDetection({ workspaceId, serviceId = null, thresholds = {} }) {
  if (!workspaceId) {
    const err = new Error("workspaceId is required");
    err.status = 400;
    throw err;
  }

  const query = { workspaceId };
  if (serviceId) query.serviceId = serviceId;

  const metrics = await ServiceMetrics.find(query)
    .sort({ timestamp: -1 })
    .limit(30)
    .lean();

  if (!metrics.length) {
    return {
      anomalyDetected: false,
      affectedService: serviceId || `workspace-${workspaceId}`,
      severity: "none",
      findings: [],
      impact: "insufficient metrics data",
      baseline: null,
      latest: null,
    };
  }

  const latestDoc = metrics[0];
  const baselineDocs = metrics.slice(1);

  const latest = {
    cpuUsage: normalizeNumber(latestDoc.cpuUsage, 0),
    memoryUsage: normalizeNumber(latestDoc.memoryUsage, 0),
    latency: normalizeNumber(latestDoc.latency, 0),
    errorRate: normalizeNumber(latestDoc.errorRate, 0),
    traffic: normalizeNumber(latestDoc.traffic, 0),
    timestamp: latestDoc.timestamp,
  };

  const baseline = {
    cpuUsage: round2(avg(baselineDocs.map((d) => normalizeNumber(d.cpuUsage, 0)))),
    memoryUsage: round2(avg(baselineDocs.map((d) => normalizeNumber(d.memoryUsage, 0)))),
    latency: round2(avg(baselineDocs.map((d) => normalizeNumber(d.latency, 0)))),
    errorRate: round2(avg(baselineDocs.map((d) => normalizeNumber(d.errorRate, 0)))),
    traffic: round2(avg(baselineDocs.map((d) => normalizeNumber(d.traffic, 0)))),
  };

  const resolvedThresholds = createThresholds(thresholds);
  const findings = detectFindings({ latest, baseline, thresholds: resolvedThresholds });
  const severity = calculateSeverity(findings);
  const impact = buildImpact(findings);

  return {
    anomalyDetected: findings.length > 0,
    affectedService: latestDoc.serviceId || serviceId || `workspace-${workspaceId}`,
    severity,
    findings,
    impact,
    baseline,
    latest,
    thresholds: resolvedThresholds,
  };
}

module.exports = {
  runAnomalyDetection,
};
