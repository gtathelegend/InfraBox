/* eslint-disable @typescript-eslint/no-require-imports */
const ServiceMetrics = require("../../models/ServiceMetrics");
const Deployment = require("../../models/Deployment");
const Workspace = require("../../models/Workspace");

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function classifyServiceStatus(snapshot) {
  const cpu = normalizeNumber(snapshot.cpuUsage, 0);
  const memory = normalizeNumber(snapshot.memoryUsage, 0);
  const latency = normalizeNumber(snapshot.latency, 0);
  const errorRate = normalizeNumber(snapshot.errorRate, 0);

  if (cpu > 90 || memory > 90 || latency > 1500 || errorRate > 10) return "critical";
  if (cpu > 80 || memory > 80 || latency > 1000 || errorRate > 5) return "degraded";
  return "healthy";
}

function buildServiceAlerts(service) {
  const alerts = [];

  if (service.cpuUsage > 85) {
    alerts.push({
      type: "cpu",
      severity: service.cpuUsage > 92 ? "high" : "medium",
      message: `CPU usage elevated for ${service.serviceId}: ${service.cpuUsage}%`,
    });
  }

  if (service.memoryUsage > 85) {
    alerts.push({
      type: "memory",
      severity: service.memoryUsage > 92 ? "high" : "medium",
      message: `Memory usage elevated for ${service.serviceId}: ${service.memoryUsage}%`,
    });
  }

  if (service.latency > 1200) {
    alerts.push({
      type: "latency",
      severity: service.latency > 2000 ? "high" : "medium",
      message: `Latency spike for ${service.serviceId}: ${service.latency}ms`,
    });
  }

  if (service.errorRate > 5) {
    alerts.push({
      type: "error_rate",
      severity: service.errorRate > 10 ? "high" : "medium",
      message: `Error rate spike for ${service.serviceId}: ${service.errorRate}%`,
    });
  }

  return alerts;
}

function buildTrendBuckets(metrics) {
  const bucketMap = new Map();

  for (const m of metrics) {
    const key = new Date(m.timestamp).toISOString();
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        timestamp: key,
        cpu: [],
        memory: [],
        latency: [],
        errorRate: [],
        traffic: [],
      });
    }

    const entry = bucketMap.get(key);
    entry.cpu.push(normalizeNumber(m.cpuUsage, 0));
    entry.memory.push(normalizeNumber(m.memoryUsage, 0));
    entry.latency.push(normalizeNumber(m.latency, 0));
    entry.errorRate.push(normalizeNumber(m.errorRate, 0));
    entry.traffic.push(normalizeNumber(m.traffic, 0));
  }

  const sorted = [...bucketMap.values()].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const avg = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  return {
    cpuUsageGraph: sorted.map((item) => ({ timestamp: item.timestamp, value: round2(avg(item.cpu)) })),
    memoryUsageGraph: sorted.map((item) => ({ timestamp: item.timestamp, value: round2(avg(item.memory)) })),
    latencyTrends: sorted.map((item) => ({ timestamp: item.timestamp, value: round2(avg(item.latency)) })),
    errorRateTrends: sorted.map((item) => ({ timestamp: item.timestamp, value: round2(avg(item.errorRate)) })),
    trafficTrends: sorted.map((item) => ({ timestamp: item.timestamp, value: round2(avg(item.traffic)) })),
  };
}

async function getDashboardOverview({ workspaceId }) {
  if (!workspaceId) {
    const err = new Error("workspaceId is required");
    err.status = 400;
    throw err;
  }

  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) {
    const err = new Error("Workspace not found");
    err.status = 404;
    throw err;
  }

  const recentMetrics = await ServiceMetrics.find({ workspaceId })
    .sort({ timestamp: -1 })
    .limit(600)
    .lean();

  const latestByService = new Map();
  for (const metric of recentMetrics) {
    if (!latestByService.has(metric.serviceId)) {
      latestByService.set(metric.serviceId, metric);
    }
  }

  const services = [...latestByService.values()].map((metric) => {
    const service = {
      serviceId: metric.serviceId,
      status: classifyServiceStatus(metric),
      cpuUsage: round2(normalizeNumber(metric.cpuUsage, 0)),
      memoryUsage: round2(normalizeNumber(metric.memoryUsage, 0)),
      latency: round2(normalizeNumber(metric.latency, 0)),
      errorRate: round2(normalizeNumber(metric.errorRate, 0)),
      traffic: round2(normalizeNumber(metric.traffic, 0)),
      lastUpdated: metric.timestamp,
    };

    return service;
  });

  const metrics = buildTrendBuckets(recentMetrics);

  const generatedAlerts = services.flatMap((service) => buildServiceAlerts(service));
  const workspaceAlerts = (workspace.alerts || []).map((alert) => ({
    type: "workspace",
    severity: "medium",
    message: String(alert),
  }));

  const activeAlerts = [...generatedAlerts, ...workspaceAlerts];

  const deployments = await Deployment.find({ workspaceId })
    .sort({ startedAt: -1 })
    .limit(20)
    .lean();

  return {
    services,
    metrics,
    activeAlerts,
    deployments,
  };
}

module.exports = {
  getDashboardOverview,
};
