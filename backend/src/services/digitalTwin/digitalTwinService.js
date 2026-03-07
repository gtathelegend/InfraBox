/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../../models/Repository");
const ServiceNode = require("../../models/ServiceNode");
const ServiceEdge = require("../../models/ServiceEdge");
const SimulationResult = require("../../models/SimulationResult");
const ParsedPipeline = require("../../models/ParsedPipeline");
const PipelineMetrics = require("../../models/PipelineMetrics");
const ResourceMetrics = require("../../models/ResourceMetrics");
const {
  generateDependencyGraph,
} = require("../repositoryAnalyzer/dependencyGraphBuilderService");

const DEFAULT_BASE_TRAFFIC = 1000;
const DEFAULT_MEMORY_LIMIT = 100;

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function parseTrafficLevel(trafficLevel) {
  if (typeof trafficLevel === "number") {
    if (trafficLevel <= 0) {
      const err = new Error("trafficLevel must be greater than 0");
      err.status = 400;
      throw err;
    }
    return trafficLevel;
  }

  if (typeof trafficLevel === "string") {
    const cleaned = trafficLevel.trim().toLowerCase().replace(/users?\s*(per|\/)\s*min(ute)?/g, "");
    const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/i);

    if (match) {
      const base = Number(match[1]);
      const unit = (match[2] || "").toLowerCase();
      const scale = unit === "k" ? 1000 : unit === "m" ? 1000000 : unit === "b" ? 1000000000 : 1;
      return base * scale;
    }
  }

  const err = new Error("trafficLevel must be a number or shorthand string like '10k'");
  err.status = 400;
  throw err;
}

function getTypeCoefficients(type) {
  const key = String(type || "service").toLowerCase();

  if (key === "database") {
    return { cpu: 0.75, memory: 1.2, latency: 0.6, error: 0.5 };
  }

  if (key === "cache") {
    return { cpu: 0.6, memory: 0.75, latency: 0.35, error: 0.35 };
  }

  if (key === "frontend") {
    return { cpu: 0.65, memory: 0.55, latency: 0.45, error: 0.35 };
  }

  if (key === "gateway") {
    return { cpu: 0.85, memory: 0.65, latency: 0.55, error: 0.45 };
  }

  if (key === "auth") {
    return { cpu: 0.8, memory: 0.7, latency: 0.55, error: 0.5 };
  }

  return { cpu: 1.0, memory: 0.85, latency: 0.7, error: 0.6 };
}

function buildDependencyMap(nodes, edges) {
  const depsByService = new Map(nodes.map((node) => [node.name, []]));
  const incomingByService = new Map(nodes.map((node) => [node.name, []]));

  for (const edge of edges) {
    if (!depsByService.has(edge.source) || !incomingByService.has(edge.target)) continue;
    depsByService.get(edge.source).push(edge.target);
    incomingByService.get(edge.target).push(edge.source);
  }

  return { depsByService, incomingByService };
}

function propagateLoad(nodes, edges, trafficFactor) {
  const loadByService = new Map(nodes.map((node) => [node.name, Math.max(1, trafficFactor)]));

  // Fixed-round propagation keeps this deterministic even if the graph has cycles.
  for (let i = 0; i < 2; i += 1) {
    const next = new Map(loadByService);

    for (const edge of edges) {
      const sourceLoad = loadByService.get(edge.source) || 1;
      const priorTarget = next.get(edge.target) || 1;
      const propagated = sourceLoad * 0.15;
      next.set(edge.target, clamp(priorTarget + propagated, 0, 8));
    }

    for (const [key, value] of next.entries()) {
      loadByService.set(key, value);
    }
  }

  return loadByService;
}

function buildRiskIndicators(servicePredictions, context) {
  const indicators = [];

  for (const service of servicePredictions) {
    if (service.cpuUsage > 85) {
      indicators.push({
        severity: "high",
        service: service.name,
        issue: `${service.name} CPU usage may exceed safe threshold`,
        recommendation: "Increase replicas or optimize CPU-intensive handlers.",
      });
    }

    if (service.memoryUsage > context.memoryLimit) {
      indicators.push({
        severity: "high",
        service: service.name,
        issue: `${service.name} memory usage may exceed container limit`,
        recommendation: "Increase container memory limit and optimize memory allocations.",
      });
    }

    if (service.latency > context.latencyThreshold) {
      indicators.push({
        severity: "medium",
        service: service.name,
        issue: `${service.name} latency is predicted to breach threshold`,
        recommendation: "Scale dependent services and reduce hot path blocking operations.",
      });
    }

    if (service.errorProbability > context.errorProbabilityThreshold) {
      indicators.push({
        severity: "medium",
        service: service.name,
        issue: `${service.name} error probability is elevated under target traffic`,
        recommendation: "Harden retries, timeouts, and dependency failure handling.",
      });
    }
  }

  const overallRisk = indicators.some((item) => item.severity === "high")
    ? "HIGH"
    : indicators.length
      ? "MEDIUM"
      : "LOW";

  return {
    overallRisk,
    indicators,
  };
}

async function loadPipelineMetricsSummary(repositoryId) {
  const pipelines = await ParsedPipeline.find({ repositoryId }, { _id: 1 });
  if (!pipelines.length) {
    return {
      avgStageDuration: 0,
      stageFailureRate: 0,
      totalStageExecutions: 0,
    };
  }

  const pipelineIds = pipelines.map((row) => row._id);
  const rows = await PipelineMetrics.find({ pipelineId: { $in: pipelineIds } });

  if (!rows.length) {
    return {
      avgStageDuration: 0,
      stageFailureRate: 0,
      totalStageExecutions: 0,
    };
  }

  const totalDuration = rows.reduce((sum, row) => sum + normalizeNumber(row.duration), 0);
  const failed = rows.filter((row) => row.status === "failed").length;

  return {
    avgStageDuration: totalDuration / rows.length,
    stageFailureRate: (failed / rows.length) * 100,
    totalStageExecutions: rows.length,
  };
}

async function ensureDependencyGraph(repositoryId, userId) {
  let nodes = await ServiceNode.find({ repositoryId }).lean();
  let edges = await ServiceEdge.find({ repositoryId }).lean();

  if (!nodes.length) {
    await generateDependencyGraph({ repositoryId, userId });
    nodes = await ServiceNode.find({ repositoryId }).lean();
    edges = await ServiceEdge.find({ repositoryId }).lean();
  }

  return { nodes, edges };
}

async function runDigitalTwinSimulation({ repositoryId, trafficLevel, userId, options = {} }) {
  const repository = await Repository.findById(repositoryId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  const trafficUsersPerMinute = parseTrafficLevel(trafficLevel);

  const [latestSimulation, runtimeRows, pipelineSummary, graph] = await Promise.all([
    SimulationResult.findOne({ repositoryId }).sort({ timestamp: -1 }).lean(),
    ResourceMetrics.find({ workspaceId: repository.workspaceId }).sort({ timestamp: -1 }).limit(20).lean(),
    loadPipelineMetricsSummary(repositoryId),
    ensureDependencyGraph(repositoryId, userId),
  ]);

  if (!graph.nodes.length) {
    const err = new Error("No service dependency graph found for repository");
    err.status = 404;
    throw err;
  }

  const runtimeCpu = runtimeRows.length
    ? runtimeRows.reduce((sum, row) => sum + normalizeNumber(row.cpuUsage), 0) / runtimeRows.length
    : 0;
  const runtimeMemory = runtimeRows.length
    ? runtimeRows.reduce((sum, row) => sum + normalizeNumber(row.memoryUsage), 0) / runtimeRows.length
    : 0;

  const baseCpu = latestSimulation
    ? (normalizeNumber(latestSimulation.cpuUsage) * 0.6) + (runtimeCpu * 0.4)
    : runtimeCpu || 35;
  const baseMemory = latestSimulation
    ? (normalizeNumber(latestSimulation.memoryUsage) * 0.65) + (runtimeMemory * 0.35)
    : runtimeMemory || 40;
  const baseLatency = latestSimulation
    ? normalizeNumber(latestSimulation.latency)
    : Math.max(120, pipelineSummary.avgStageDuration * 20);
  const baseErrorRate = latestSimulation
    ? normalizeNumber(latestSimulation.errorRate)
    : clamp(pipelineSummary.stageFailureRate * 0.5, 0, 100);

  const baselineTraffic = normalizeNumber(options.baselineTraffic, DEFAULT_BASE_TRAFFIC);
  const trafficFactor = clamp(trafficUsersPerMinute / Math.max(1, baselineTraffic), 0.1, 15);

  const { depsByService, incomingByService } = buildDependencyMap(graph.nodes, graph.edges);
  const loadByService = propagateLoad(graph.nodes, graph.edges, trafficFactor);
  const memoryLimit = normalizeNumber(options.memoryLimit, DEFAULT_MEMORY_LIMIT);
  const latencyThreshold = normalizeNumber(options.latencyThreshold, 1000);
  const errorProbabilityThreshold = normalizeNumber(options.errorProbabilityThreshold, 20);

  const servicePredictions = graph.nodes.map((node) => {
    const deps = depsByService.get(node.name) || [];
    const incoming = incomingByService.get(node.name) || [];
    const loadFactor = loadByService.get(node.name) || 1;
    const coefficients = getTypeCoefficients(node.type);

    const cpuUsage = clamp(
      baseCpu * (1 + Math.max(0, loadFactor - 1) * coefficients.cpu),
      0,
      100
    );
    const memoryUsage = clamp(
      baseMemory * (1 + Math.max(0, loadFactor - 1) * coefficients.memory),
      0,
      200
    );

    const dependencyPenalty = deps.length * 0.04;
    const latency = Math.max(
      1,
      baseLatency * (1 + Math.max(0, loadFactor - 1) * coefficients.latency + dependencyPenalty)
    );

    const pressure = (cpuUsage > 85 ? 12 : 0) + (memoryUsage > memoryLimit ? 10 : 0);
    const dependencyRisk = incoming.length * 1.8;
    const errorProbability = clamp(
      baseErrorRate + Math.max(0, loadFactor - 1) * 10 * coefficients.error + pressure + dependencyRisk,
      0,
      100
    );

    return {
      name: node.name,
      type: node.type,
      cpuUsage: round2(cpuUsage),
      memoryUsage: round2(memoryUsage),
      latency: round2(latency),
      requestRate: round2((trafficUsersPerMinute / graph.nodes.length) * loadFactor),
      errorProbability: round2(errorProbability),
      dependencies: deps,
    };
  });

  const aggregate = {
    cpuUsage: round2(
      servicePredictions.reduce((sum, row) => sum + row.cpuUsage, 0) / servicePredictions.length
    ),
    memoryUsage: round2(
      servicePredictions.reduce((sum, row) => sum + row.memoryUsage, 0) / servicePredictions.length
    ),
    latency: round2(
      servicePredictions.reduce((sum, row) => sum + row.latency, 0) / servicePredictions.length
    ),
    errorProbability: round2(
      servicePredictions.reduce((sum, row) => sum + row.errorProbability, 0) / servicePredictions.length
    ),
    requestRate: round2(servicePredictions.reduce((sum, row) => sum + row.requestRate, 0)),
  };

  const risks = buildRiskIndicators(servicePredictions, {
    memoryLimit,
    latencyThreshold,
    errorProbabilityThreshold,
  });

  return {
    repositoryId: String(repository._id),
    repositoryName: repository.name,
    trafficLevel: trafficUsersPerMinute,
    trafficFactor: round2(trafficFactor),
    inputDataSummary: {
      simulationResultFound: Boolean(latestSimulation),
      pipelineStageExecutions: pipelineSummary.totalStageExecutions,
      runtimeSamples: runtimeRows.length,
      serviceNodes: graph.nodes.length,
      serviceEdges: graph.edges.length,
    },
    predictedMetrics: {
      aggregate,
      services: servicePredictions,
    },
    riskIndicators: {
      overallRisk: risks.overallRisk,
      items: risks.indicators,
    },
  };
}

module.exports = {
  runDigitalTwinSimulation,
};
