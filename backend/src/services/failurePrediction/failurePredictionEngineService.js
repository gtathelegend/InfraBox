/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs/promises");
const path = require("path");

const Repository = require("../../models/Repository");
const ParsedPipeline = require("../../models/ParsedPipeline");
const PipelineMetrics = require("../../models/PipelineMetrics");
const SimulationResult = require("../../models/SimulationResult");
const ResourceMetrics = require("../../models/ResourceMetrics");

const FEATURE_NAMES = [
  "avg_cpu_usage",
  "avg_memory_usage",
  "error_rate",
  "latency",
  "pipeline_failure_rate",
  "memory_growth_pattern",
  "cpu_spike_signal",
  "error_rate_trend",
  "latency_trend",
  "log_anomaly_score",
];

const MODELS_DIR = path.join(process.cwd(), ".infrabox", "models");
const MODEL_VERSION = "failure-logreg-v1";

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round4(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeGrowth(values) {
  if (values.length < 2) return 0;
  const first = Math.max(values[0], 1);
  const last = values[values.length - 1];
  return (last - first) / first;
}

function computeSpikeSignal(values) {
  if (!values.length) return 0;
  const avg = average(values);
  if (avg <= 0) return 0;
  const threshold = avg * 1.2;
  const spikeCount = values.filter((value) => value >= threshold).length;
  return spikeCount / values.length;
}

function computeTrendDelta(values) {
  if (values.length < 4) return 0;
  const splitAt = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, splitAt);
  const secondHalf = values.slice(splitAt);
  return average(secondHalf) - average(firstHalf);
}

function extractLogAnomalyScore(logLines) {
  if (!logLines || !logLines.length) return 0;

  const riskPattern = /oom|out of memory|heap|crash|fatal|timeout|exception|failed|segfault|unhandled/i;
  const matches = logLines.filter((line) => riskPattern.test(String(line || ""))).length;
  return matches / logLines.length;
}

function getRiskLevel(probability) {
  if (probability >= 0.7) return "HIGH";
  if (probability >= 0.4) return "MEDIUM";
  return "LOW";
}

function selectMitigation(features) {
  const weightedSignals = [
    {
      key: "memory_growth_pattern",
      value: features.memory_growth_pattern,
      reason: "memory growth anomaly",
      mitigation: "Increase memory limit, inspect leaks, and optimize object retention.",
    },
    {
      key: "cpu_spike_signal",
      value: features.cpu_spike_signal,
      reason: "CPU spike pattern detected",
      mitigation: "Scale replicas and profile expensive CPU paths.",
    },
    {
      key: "error_rate_trend",
      value: features.error_rate_trend,
      reason: "error rate trend is increasing",
      mitigation: "Improve retries/circuit breakers and investigate failing dependencies.",
    },
    {
      key: "latency_trend",
      value: features.latency_trend,
      reason: "latency trend is increasing",
      mitigation: "Tune hot paths, add caching, and scale downstream services.",
    },
    {
      key: "pipeline_failure_rate",
      value: features.pipeline_failure_rate,
      reason: "pipeline instability observed",
      mitigation: "Stabilize flaky stages and gate deployments on quality checks.",
    },
    {
      key: "log_anomaly_score",
      value: features.log_anomaly_score,
      reason: "critical log anomalies detected",
      mitigation: "Prioritize triage of recurring runtime errors and crash signatures.",
    },
  ];

  const top = weightedSignals
    .map((entry) => ({ ...entry, magnitude: Math.abs(normalizeNumber(entry.value)) }))
    .sort((a, b) => b.magnitude - a.magnitude)[0];

  if (!top || top.magnitude < 0.05) {
    return {
      reason: "general resource pressure",
      recommendedMitigation: "Add autoscaling and tighten service SLO monitoring.",
    };
  }

  return {
    reason: top.reason,
    recommendedMitigation: top.mitigation,
  };
}

async function ensureModelsDir() {
  await fs.mkdir(MODELS_DIR, { recursive: true });
}

function getModelPath(repositoryId) {
  const suffix = repositoryId ? String(repositoryId) : "global";
  return path.join(MODELS_DIR, `failure-model-${suffix}.json`);
}

async function loadSavedModel(repositoryId) {
  try {
    const modelPath = getModelPath(repositoryId);
    const raw = await fs.readFile(modelPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

async function saveModel(repositoryId, model) {
  await ensureModelsDir();
  const modelPath = getModelPath(repositoryId);
  await fs.writeFile(modelPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
}

async function fetchRepositoryScopedHistory(repositoryId) {
  const repository = await Repository.findById(repositoryId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  const [runtimeRows, simulationRows, pipelines] = await Promise.all([
    ResourceMetrics.find({ workspaceId: repository.workspaceId })
      .sort({ timestamp: 1 })
      .limit(1200)
      .lean(),
    SimulationResult.find({ repositoryId })
      .sort({ timestamp: 1 })
      .limit(800)
      .lean(),
    ParsedPipeline.find({ repositoryId }, { _id: 1 }).lean(),
  ]);

  const pipelineIds = pipelines.map((row) => row._id);
  const pipelineRows = pipelineIds.length
    ? await PipelineMetrics.find({ pipelineId: { $in: pipelineIds } })
      .sort({ timestamp: 1 })
      .limit(1500)
      .lean()
    : [];

  return {
    repository,
    runtimeRows,
    simulationRows,
    pipelineRows,
  };
}

function summarizePipelineFailureRate(pipelineRows, uptoTimestamp) {
  const selected = pipelineRows.filter((row) => {
    if (!uptoTimestamp) return true;
    return new Date(row.timestamp).getTime() <= new Date(uptoTimestamp).getTime();
  });

  if (!selected.length) return 0;
  const failed = selected.filter((row) => row.status === "failed").length;
  return failed / selected.length;
}

function summarizeSimulationForTimestamp(simulationRows, timestamp) {
  if (!simulationRows.length) {
    return {
      errorRate: 0,
      latency: 0,
      errorRateTrend: 0,
      latencyTrend: 0,
      logAnomalyScore: 0,
      status: "unknown",
    };
  }

  const targetTime = timestamp ? new Date(timestamp).getTime() : Number.MAX_SAFE_INTEGER;
  const eligible = simulationRows.filter((row) => new Date(row.timestamp).getTime() <= targetTime);
  const baseRows = eligible.length ? eligible : simulationRows;
  const recent = baseRows.slice(-6);

  return {
    errorRate: average(recent.map((row) => normalizeNumber(row.errorRate))),
    latency: average(recent.map((row) => normalizeNumber(row.latency))),
    errorRateTrend: computeTrendDelta(recent.map((row) => normalizeNumber(row.errorRate))),
    latencyTrend: computeTrendDelta(recent.map((row) => normalizeNumber(row.latency))),
    logAnomalyScore: extractLogAnomalyScore(recent.flatMap((row) => row.logs || [])),
    status: recent[recent.length - 1]?.status || "unknown",
  };
}

function buildTrainingDataset(history) {
  const byService = new Map();

  for (const row of history.runtimeRows) {
    const serviceName = String(row.resourceId || row.resourceType || "unknown-service");
    if (!byService.has(serviceName)) byService.set(serviceName, []);
    byService.get(serviceName).push(row);
  }

  const dataset = [];

  for (const [serviceName, rows] of byService.entries()) {
    const ordered = [...rows].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const chunkSize = Math.max(6, Math.floor(ordered.length / 8));

    for (let start = 0; start < ordered.length; start += chunkSize) {
      const chunk = ordered.slice(start, start + chunkSize);
      if (chunk.length < 4) continue;

      const timestamp = chunk[chunk.length - 1].timestamp;
      const cpuSeries = chunk.map((item) => normalizeNumber(item.cpuUsage));
      const memorySeries = chunk.map((item) => normalizeNumber(item.memoryUsage));

      const simulationSummary = summarizeSimulationForTimestamp(history.simulationRows, timestamp);
      const pipelineFailureRate = summarizePipelineFailureRate(history.pipelineRows, timestamp);

      const feature = {
        serviceName,
        avg_cpu_usage: average(cpuSeries),
        avg_memory_usage: average(memorySeries),
        error_rate: normalizeNumber(simulationSummary.errorRate),
        latency: normalizeNumber(simulationSummary.latency),
        pipeline_failure_rate: pipelineFailureRate,
        memory_growth_pattern: computeGrowth(memorySeries),
        cpu_spike_signal: computeSpikeSignal(cpuSeries),
        error_rate_trend: simulationSummary.errorRateTrend,
        latency_trend: simulationSummary.latencyTrend,
        log_anomaly_score: simulationSummary.logAnomalyScore,
      };

      const label =
        feature.avg_cpu_usage > 85 ||
        feature.avg_memory_usage > 90 ||
        feature.error_rate > 12 ||
        feature.latency > 1200 ||
        feature.pipeline_failure_rate > 0.3 ||
        feature.memory_growth_pattern > 0.35 ||
        feature.cpu_spike_signal > 0.4 ||
        feature.error_rate_trend > 2 ||
        feature.latency_trend > 120 ||
        simulationSummary.status === "failed";

      dataset.push({ feature, label: label ? 1 : 0 });
    }
  }

  return dataset;
}

function trainLogisticRegression(dataset, options = {}) {
  if (!dataset.length) {
    const err = new Error("Insufficient historical data to train model");
    err.status = 400;
    throw err;
  }

  const learningRate = normalizeNumber(options.learningRate, 0.08);
  const epochs = Math.max(100, Math.floor(normalizeNumber(options.epochs, 700)));
  const regularization = normalizeNumber(options.regularization, 0.0005);

  const matrix = dataset.map((row) => FEATURE_NAMES.map((name) => normalizeNumber(row.feature[name])));
  const labels = dataset.map((row) => normalizeNumber(row.label));

  const means = FEATURE_NAMES.map((_, colIdx) => average(matrix.map((row) => row[colIdx])));
  const stds = FEATURE_NAMES.map((_, colIdx) => {
    const mean = means[colIdx];
    const variance = average(matrix.map((row) => {
      const centered = row[colIdx] - mean;
      return centered * centered;
    }));
    const std = Math.sqrt(variance);
    return std > 1e-6 ? std : 1;
  });

  const normalized = matrix.map((row) => row.map((value, idx) => (value - means[idx]) / stds[idx]));

  let bias = 0;
  const weights = FEATURE_NAMES.map(() => 0);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const grads = FEATURE_NAMES.map(() => 0);
    let gradBias = 0;

    for (let i = 0; i < normalized.length; i += 1) {
      const row = normalized[i];
      const target = labels[i];

      let z = bias;
      for (let j = 0; j < row.length; j += 1) {
        z += row[j] * weights[j];
      }

      const pred = sigmoid(z);
      const error = pred - target;
      gradBias += error;

      for (let j = 0; j < row.length; j += 1) {
        grads[j] += error * row[j];
      }
    }

    const n = normalized.length;
    bias -= learningRate * (gradBias / n);

    for (let j = 0; j < weights.length; j += 1) {
      const regTerm = regularization * weights[j];
      weights[j] -= learningRate * ((grads[j] / n) + regTerm);
    }
  }

  let correct = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    let z = bias;
    for (let j = 0; j < FEATURE_NAMES.length; j += 1) {
      z += normalized[i][j] * weights[j];
    }
    const pred = sigmoid(z) >= 0.5 ? 1 : 0;
    if (pred === labels[i]) correct += 1;
  }

  return {
    version: MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    featureNames: FEATURE_NAMES,
    weights: weights.map((value) => round4(value)),
    bias: round4(bias),
    means: means.map((value) => round4(value)),
    stds: stds.map((value) => round4(value)),
    trainingSamples: dataset.length,
    trainingAccuracy: round4(correct / dataset.length),
  };
}

function scoreFeatureVector(model, featureVector) {
  let z = normalizeNumber(model.bias);

  for (let i = 0; i < FEATURE_NAMES.length; i += 1) {
    const value = normalizeNumber(featureVector[FEATURE_NAMES[i]]);
    const mean = normalizeNumber(model.means[i]);
    const std = normalizeNumber(model.stds[i], 1) || 1;
    const normalized = (value - mean) / std;
    z += normalized * normalizeNumber(model.weights[i]);
  }

  return sigmoid(z);
}

function buildFeatureFromInput(entry, simulationSummary, pipelineFailureRate) {
  const cpuUsage = normalizeNumber(entry.cpuUsage ?? entry.avg_cpu_usage);
  const memoryUsage = normalizeNumber(entry.memoryUsage ?? entry.avg_memory_usage);
  const latency = normalizeNumber(entry.latency ?? simulationSummary.latency);
  const errorRate = normalizeNumber(entry.errorRate ?? simulationSummary.errorRate);

  const cpuSeries = Array.isArray(entry.cpuSeries)
    ? entry.cpuSeries.map((v) => normalizeNumber(v))
    : [cpuUsage * 0.9, cpuUsage, cpuUsage * 1.05];

  const memorySeries = Array.isArray(entry.memorySeries)
    ? entry.memorySeries.map((v) => normalizeNumber(v))
    : [memoryUsage * 0.9, memoryUsage, memoryUsage * 1.05];

  const logLines = [];
  if (Array.isArray(entry.systemLogs)) logLines.push(...entry.systemLogs);
  if (Array.isArray(simulationSummary.logs)) logLines.push(...simulationSummary.logs);

  return {
    serviceName: entry.serviceName || entry.name || entry.resourceId || "unknown-service",
    avg_cpu_usage: cpuUsage,
    avg_memory_usage: memoryUsage,
    error_rate: errorRate,
    latency,
    pipeline_failure_rate: pipelineFailureRate,
    memory_growth_pattern: computeGrowth(memorySeries),
    cpu_spike_signal: computeSpikeSignal(cpuSeries),
    error_rate_trend: normalizeNumber(entry.errorRateTrend, simulationSummary.errorRateTrend),
    latency_trend: normalizeNumber(entry.latencyTrend, simulationSummary.latencyTrend),
    log_anomaly_score: extractLogAnomalyScore(logLines),
  };
}

function normalizeServiceMetricsInput(serviceMetrics) {
  if (!serviceMetrics) return [];
  if (Array.isArray(serviceMetrics)) return serviceMetrics;
  if (typeof serviceMetrics === "object") return [serviceMetrics];
  return [];
}

function summarizeSimulationInput(simulationResults) {
  if (!simulationResults) {
    return {
      errorRate: 0,
      latency: 0,
      errorRateTrend: 0,
      latencyTrend: 0,
      logs: [],
    };
  }

  const rows = Array.isArray(simulationResults) ? simulationResults : [simulationResults];
  const mapped = rows
    .map((row) => ({
      errorRate: normalizeNumber(row.errorRate),
      latency: normalizeNumber(row.latency),
      logs: Array.isArray(row.logs) ? row.logs : [],
    }));

  return {
    errorRate: average(mapped.map((row) => row.errorRate)),
    latency: average(mapped.map((row) => row.latency)),
    errorRateTrend: computeTrendDelta(mapped.map((row) => row.errorRate)),
    latencyTrend: computeTrendDelta(mapped.map((row) => row.latency)),
    logs: mapped.flatMap((row) => row.logs),
  };
}

async function ensureTrainedModel(repositoryId) {
  const cached = await loadSavedModel(repositoryId);

  const staleMs = 1000 * 60 * 60 * 6;
  if (cached?.trainedAt && (Date.now() - new Date(cached.trainedAt).getTime()) < staleMs) {
    return cached;
  }

  if (!repositoryId) {
    if (cached) return cached;
    const err = new Error("repositoryId is required to train a new model");
    err.status = 400;
    throw err;
  }

  const history = await fetchRepositoryScopedHistory(repositoryId);
  const dataset = buildTrainingDataset(history);

  if (!dataset.length) {
    const err = new Error("Not enough historical runtime/simulation data to train failure model");
    err.status = 400;
    throw err;
  }

  const model = trainLogisticRegression(dataset);
  await saveModel(repositoryId, model);

  return model;
}

async function computePipelineFailureRate(repositoryId) {
  if (!repositoryId) return 0;
  const pipelines = await ParsedPipeline.find({ repositoryId }, { _id: 1 }).lean();
  if (!pipelines.length) return 0;

  const pipelineIds = pipelines.map((row) => row._id);
  const rows = await PipelineMetrics.find({ pipelineId: { $in: pipelineIds } })
    .sort({ timestamp: -1 })
    .limit(400)
    .lean();

  if (!rows.length) return 0;
  const failed = rows.filter((row) => row.status === "failed").length;
  return failed / rows.length;
}

async function predictServiceFailures({ repositoryId, serviceMetrics, simulationResults }) {
  const model = await ensureTrainedModel(repositoryId);
  const entries = normalizeServiceMetricsInput(serviceMetrics);

  if (!entries.length) {
    const err = new Error("serviceMetrics is required");
    err.status = 400;
    throw err;
  }

  const simulationSummary = summarizeSimulationInput(simulationResults);
  const pipelineFailureRate = await computePipelineFailureRate(repositoryId);

  const predictions = entries.map((entry) => {
    const features = buildFeatureFromInput(entry, simulationSummary, pipelineFailureRate);
    const probability = scoreFeatureVector(model, features);
    const mitigation = selectMitigation(features);

    return {
      service: features.serviceName,
      failureProbability: round4(probability),
      riskLevel: getRiskLevel(probability),
      reason: mitigation.reason,
      recommendedMitigation: mitigation.recommendedMitigation,
      features: {
        avg_cpu_usage: round4(features.avg_cpu_usage),
        avg_memory_usage: round4(features.avg_memory_usage),
        error_rate: round4(features.error_rate),
        latency: round4(features.latency),
        pipeline_failure_rate: round4(features.pipeline_failure_rate),
      },
    };
  });

  return {
    model: {
      version: model.version,
      trainedAt: model.trainedAt,
      trainingSamples: model.trainingSamples,
      trainingAccuracy: model.trainingAccuracy,
    },
    predictions,
  };
}

module.exports = {
  predictServiceFailures,
};
