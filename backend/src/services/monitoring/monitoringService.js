/* eslint-disable @typescript-eslint/no-require-imports */
const Workspace = require("../../models/Workspace");
const Repository = require("../../models/Repository");
const ResourceMetrics = require("../../models/ResourceMetrics");
const SimulationResult = require("../../models/SimulationResult");
const CostPrediction = require("../../models/CostPrediction");
const ServiceMetrics = require("../../models/ServiceMetrics");

const COLLECTION_INTERVAL_MS = 30 * 1000;

let collectionTimer = null;

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildServiceId(workspaceId) {
  return `workspace-${String(workspaceId)}`;
}

async function queryPrometheus(query) {
  const baseUrl = process.env.PROMETHEUS_BASE_URL;
  if (!baseUrl || !query) return null;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/v1/query?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) return null;
    const payload = await response.json();
    const first = payload?.data?.result?.[0]?.value?.[1];
    return first !== undefined ? normalizeNumber(first, 0) : null;
  } catch {
    return null;
  }
}

async function collectFromPrometheus(workspaceId) {
  const cpuQuery = process.env.PROM_QUERY_CPU || "avg(rate(container_cpu_usage_seconds_total[5m])) * 100";
  const memoryQuery = process.env.PROM_QUERY_MEMORY || "avg(container_memory_usage_bytes / container_spec_memory_limit_bytes) * 100";
  const latencyQuery = process.env.PROM_QUERY_LATENCY || "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) * 1000";
  const errorRateQuery = process.env.PROM_QUERY_ERROR_RATE || "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100";
  const trafficQuery = process.env.PROM_QUERY_TRAFFIC || "sum(rate(http_requests_total[5m]))";

  const [cpu, memory, latency, errorRate, traffic] = await Promise.all([
    queryPrometheus(cpuQuery),
    queryPrometheus(memoryQuery),
    queryPrometheus(latencyQuery),
    queryPrometheus(errorRateQuery),
    queryPrometheus(trafficQuery),
  ]);

  if ([cpu, memory, latency, errorRate, traffic].every((value) => value === null)) {
    return null;
  }

  return {
    workspaceId,
    cpuUsage: round2(normalizeNumber(cpu, 0)),
    memoryUsage: round2(normalizeNumber(memory, 0)),
    latency: round2(normalizeNumber(latency, 0)),
    errorRate: round2(normalizeNumber(errorRate, 0)),
    traffic: round2(normalizeNumber(traffic, 0)),
    source: "prometheus",
  };
}

async function collectFromOpenTelemetry(workspaceId) {
  const otelEndpoint = process.env.OTEL_COLLECTOR_METRICS_URL;
  if (!otelEndpoint) return null;

  try {
    const response = await fetch(`${otelEndpoint}?workspaceId=${encodeURIComponent(String(workspaceId))}`);
    if (!response.ok) return null;

    const payload = await response.json();
    const metrics = payload?.metrics || payload;

    return {
      workspaceId,
      cpuUsage: round2(normalizeNumber(metrics?.cpuUsage, 0)),
      memoryUsage: round2(normalizeNumber(metrics?.memoryUsage, 0)),
      latency: round2(normalizeNumber(metrics?.latency, 0)),
      errorRate: round2(normalizeNumber(metrics?.errorRate, 0)),
      traffic: round2(normalizeNumber(metrics?.traffic, 0)),
      source: "opentelemetry",
    };
  } catch {
    return null;
  }
}

async function collectFromInternalSources(workspaceId) {
  const latestResourceMetrics = await ResourceMetrics.find({ workspaceId })
    .sort({ timestamp: -1 })
    .limit(120)
    .lean();

  const repositoryIds = await Repository.find({ workspaceId }).distinct("_id");
  const latestSimulationMetrics = repositoryIds.length
    ? await SimulationResult.find({ repositoryId: { $in: repositoryIds } })
      .sort({ timestamp: -1 })
      .limit(120)
      .lean()
    : [];

  const latestCost = await CostPrediction.findOne({ workspaceId })
    .sort({ generatedAt: -1 })
    .lean();

  const cpuUsage = avg(latestResourceMetrics.map((item) => normalizeNumber(item.cpuUsage, 0)));
  const memoryUsage = avg(latestResourceMetrics.map((item) => normalizeNumber(item.memoryUsage, 0)));
  const traffic = avg(latestResourceMetrics.map((item) => normalizeNumber(item.networkUsage, 0)));

  const latency = avg(latestSimulationMetrics.map((item) => normalizeNumber(item.latency, 0)));
  const errorRate = avg(latestSimulationMetrics.map((item) => normalizeNumber(item.errorRate, 0)));

  return {
    workspaceId,
    cpuUsage: round2(cpuUsage),
    memoryUsage: round2(memoryUsage),
    latency: round2(latency),
    errorRate: round2(errorRate),
    traffic: round2(traffic),
    cloudCost: round2(normalizeNumber(latestCost?.monthlyCostEstimate, 0)),
    source: "internal",
  };
}

function mergeMetricSources({ otel, prometheus, internal }) {
  const resolved = {
    cpuUsage: otel?.cpuUsage ?? prometheus?.cpuUsage ?? internal?.cpuUsage ?? 0,
    memoryUsage: otel?.memoryUsage ?? prometheus?.memoryUsage ?? internal?.memoryUsage ?? 0,
    latency: otel?.latency ?? prometheus?.latency ?? internal?.latency ?? 0,
    errorRate: otel?.errorRate ?? prometheus?.errorRate ?? internal?.errorRate ?? 0,
    traffic: otel?.traffic ?? prometheus?.traffic ?? internal?.traffic ?? 0,
    cloudCost: internal?.cloudCost ?? 0,
  };

  return {
    ...resolved,
    sourceBreakdown: {
      opentelemetry: otel,
      prometheus,
      internal,
    },
  };
}

async function collectMetricsForWorkspace(workspaceId) {
  const [otel, prometheus, internal] = await Promise.all([
    collectFromOpenTelemetry(workspaceId),
    collectFromPrometheus(workspaceId),
    collectFromInternalSources(workspaceId),
  ]);

  const merged = mergeMetricSources({ otel, prometheus, internal });

  const saved = await ServiceMetrics.create({
    workspaceId,
    serviceId: buildServiceId(workspaceId),
    cpuUsage: merged.cpuUsage,
    memoryUsage: merged.memoryUsage,
    latency: merged.latency,
    errorRate: merged.errorRate,
    traffic: merged.traffic,
    cloudCost: merged.cloudCost,
    sourceBreakdown: merged.sourceBreakdown,
    timestamp: new Date(),
  });

  return saved;
}

async function collectMetricsForAllWorkspaces() {
  const workspaces = await Workspace.find({}).select("_id").lean();
  if (!workspaces.length) return [];

  const results = [];
  for (const workspace of workspaces) {
    try {
      const metrics = await collectMetricsForWorkspace(workspace._id);
      results.push(metrics);
    } catch (err) {
      console.warn(`Monitoring collection failed for workspace ${workspace._id}:`, err.message);
    }
  }

  return results;
}

function startMonitoringCollectors() {
  if (collectionTimer) {
    return collectionTimer;
  }

  void collectMetricsForAllWorkspaces();
  collectionTimer = setInterval(() => {
    void collectMetricsForAllWorkspaces();
  }, COLLECTION_INTERVAL_MS);

  return collectionTimer;
}

function stopMonitoringCollectors() {
  if (!collectionTimer) return;
  clearInterval(collectionTimer);
  collectionTimer = null;
}

async function getLatestMonitoringMetrics({ workspaceId, serviceId = null }) {
  const query = { workspaceId };
  if (serviceId) query.serviceId = serviceId;

  const latest = await ServiceMetrics.findOne(query)
    .sort({ timestamp: -1 })
    .lean();

  if (!latest) {
    const collected = await collectMetricsForWorkspace(workspaceId);
    return {
      cpuUsage: collected.cpuUsage,
      memoryUsage: collected.memoryUsage,
      latency: collected.latency,
      errorRate: collected.errorRate,
      traffic: collected.traffic,
      cloudCost: collected.cloudCost,
      timestamp: collected.timestamp,
    };
  }

  return {
    cpuUsage: latest.cpuUsage,
    memoryUsage: latest.memoryUsage,
    latency: latest.latency,
    errorRate: latest.errorRate,
    traffic: latest.traffic,
    cloudCost: latest.cloudCost,
    timestamp: latest.timestamp,
  };
}

module.exports = {
  COLLECTION_INTERVAL_MS,
  collectMetricsForWorkspace,
  collectMetricsForAllWorkspaces,
  startMonitoringCollectors,
  stopMonitoringCollectors,
  getLatestMonitoringMetrics,
};
