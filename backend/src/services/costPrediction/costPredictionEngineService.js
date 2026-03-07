/* eslint-disable @typescript-eslint/no-require-imports */
const ResourceMetrics = require("../../models/ResourceMetrics");
const SimulationResult = require("../../models/SimulationResult");
const CostPrediction = require("../../models/CostPrediction");

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

const PRICING_MODELS = {
  aws: {
    instanceTypes: {
      "t3.micro": 0.0104,
      "t3.small": 0.0208,
      "t3.medium": 0.0416,
      "t3.large": 0.0832,
      "m5.large": 0.096,
      "m5.xlarge": 0.192,
      "c5.large": 0.085,
      "c5.xlarge": 0.17,
    },
    storagePerGB: 0.023,
    networkOutPerGB: 0.02,
    networkInPerGB: 0.0,
    vCpuReservedPerHour: 0.031,
    memoryReservedPerGB: 0.0047,
  },
  gcp: {
    instanceTypes: {
      "n1-standard-1": 0.0475,
      "n1-standard-2": 0.095,
      "n1-standard-4": 0.19,
      "n2-standard-2": 0.0929,
      "c2-standard-4": 0.18,
      "e2-medium": 0.0335,
      "e2-standard-2": 0.0670,
      "e2-standard-4": 0.134,
    },
    storagePerGB: 0.020,
    networkOutPerGB: 0.12,
    networkInPerGB: 0.0,
    computeEngineMinCharge: 0.25,
  },
  azure: {
    instanceTypes: {
      "Standard_B1s": 0.0146,
      "Standard_B1ms": 0.0292,
      "Standard_B2s": 0.0584,
      "Standard_B2ms": 0.117,
      "Standard_D2s_v3": 0.128,
      "Standard_D4s_v3": 0.256,
    },
    storagePerGB: 0.0221,
    networkOutPerGB: 0.087,
    networkInPerGB: 0.0,
    managedDiskPerMonth: 0.5,
  },
  generic: {
    instanceTypes: {
      small: 0.05,
      medium: 0.1,
      large: 0.2,
      xlarge: 0.4,
      "2xlarge": 0.8,
    },
    storagePerGB: 0.025,
    networkOutPerGB: 0.05,
    networkInPerGB: 0.01,
  },
};

function getPricingModel(provider) {
  const key = String(provider || "aws").toLowerCase();
  return PRICING_MODELS[key] || PRICING_MODELS.generic;
}

function estimateInstanceCost(metrics) {
  const computeInstances = normalizeNumber(metrics.computeInstances, 2);
  const avgCpuUsage = normalizeNumber(metrics.avgCpuUsage, 50);
  const avgMemoryUsage = normalizeNumber(metrics.avgMemoryUsage, 50);

  const baseInstanceHourlyCost = normalizeNumber(metrics.instanceHourlyCost, 0.1);
  const utilizationFactor = 1 + (avgCpuUsage + avgMemoryUsage) / 200;

  const costPerInstance = baseInstanceHourlyCost * utilizationFactor;
  const monthlyHours = 730;

  return round2(computeInstances * costPerInstance * monthlyHours);
}

function estimateStorageCost(metrics, pricing) {
  const storageGB = normalizeNumber(metrics.storageGB, 100);
  const storageRate = normalizeNumber(metrics.storageCostPerGB, pricing.storagePerGB);

  return round2(storageGB * storageRate);
}

function estimateNetworkCost(metrics, pricing) {
  const trafficGB = normalizeNumber(metrics.networkTrafficGB, 50);
  const networkRate = normalizeNumber(metrics.networkCostPerGB, pricing.networkOutPerGB);
  const inboundNetworkRate = normalizeNumber(metrics.networkInboundCostPerGB, pricing.networkInPerGB);

  const outboundCost = trafficGB * networkRate;
  const inboundCost = Math.max(0, (trafficGB * 0.3) * inboundNetworkRate);

  return round2(outboundCost + inboundCost);
}

function estimateMonthlyBaseCost(metrics, provider = "generic") {
  const pricing = getPricingModel(provider);

  const compute = estimateInstanceCost(metrics);
  const storage = estimateStorageCost(metrics, pricing);
  const network = estimateNetworkCost(metrics, pricing);

  const total = compute + storage + network;

  return {
    computeCost: compute,
    storageCost: storage,
    networkCost: network,
    totalCost: round2(total),
  };
}

function estimateSpikeCost(baseCost, trafficSpikeFactor) {
  const spikeFactor = Math.max(1, normalizeNumber(trafficSpikeFactor, 1));

  const computeSpike = baseCost.computeCost * spikeFactor;
  const networkSpike = baseCost.networkCost * spikeFactor;
  const storageSpike = baseCost.storageCost * (1 + (spikeFactor - 1) * 0.2);

  const spikeTotal = computeSpike + networkSpike + storageSpike;

  return round2(spikeTotal);
}

function buildCostBreakdown(baseCost, spikeCost, trafficSpikeFactor) {
  const spikeFactor = Math.max(1, normalizeNumber(trafficSpikeFactor, 1));

  return {
    baseline: {
      compute: baseCost.computeCost,
      storage: baseCost.storageCost,
      network: baseCost.networkCost,
      total: baseCost.totalCost,
      percentageByType: {
        compute: round2((baseCost.computeCost / baseCost.totalCost) * 100),
        storage: round2((baseCost.storageCost / baseCost.totalCost) * 100),
        network: round2((baseCost.networkCost / baseCost.totalCost) * 100),
      },
    },
    spike: {
      total: spikeCost,
      factor: spikeFactor,
      increments: round2(spikeCost - baseCost.totalCost),
    },
  };
}

async function aggregateMetricsFromHistory(workspaceId, repositoryId = null) {
  const query = { workspaceId };
  if (repositoryId) {
    const simulation = await SimulationResult.findOne({ repositoryId }).lean();
    if (!simulation) {
      return null;
    }
  }

  const recentMetrics = await ResourceMetrics.find(query)
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

  if (!recentMetrics.length) {
    return null;
  }

  const cpuValues = recentMetrics.map((m) => normalizeNumber(m.cpuUsage));
  const memoryValues = recentMetrics.map((m) => normalizeNumber(m.memoryUsage));
  const storageValues = recentMetrics.map((m) => normalizeNumber(m.storageUsage));
  const networkValues = recentMetrics.map((m) => normalizeNumber(m.networkUsage));

  const avg = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };

  const max = (values) => {
    if (!values.length) return 0;
    return Math.max(...values);
  };

  return {
    avgCpuUsage: round2(avg(cpuValues)),
    maxCpuUsage: round2(max(cpuValues)),
    avgMemoryUsage: round2(avg(memoryValues)),
    maxMemoryUsage: round2(max(memoryValues)),
    avgStorageUsage: round2(avg(storageValues)),
    maxStorageUsage: round2(max(storageValues)),
    avgNetworkTraffic: round2(avg(networkValues)),
    maxNetworkTraffic: round2(max(networkValues)),
    sampleCount: recentMetrics.length,
  };
}

async function predictCloudCost({
  repositoryId,
  workspaceId,
  metrics,
  provider = "generic",
  trafficSpikeFactor = 1,
  assumptions = {},
}) {
  if (!workspaceId) {
    const err = new Error("workspaceId is required");
    err.status = 400;
    throw err;
  }

  let resolvedMetrics = metrics;

  if (!resolvedMetrics) {
    const aggregated = await aggregateMetricsFromHistory(workspaceId, repositoryId);

    if (!aggregated) {
      resolvedMetrics = {
        computeInstances: assumptions.computeInstances || 2,
        avgCpuUsage: assumptions.avgCpuUsage || 45,
        avgMemoryUsage: assumptions.avgMemoryUsage || 50,
        storageGB: assumptions.storageGB || 100,
        networkTrafficGB: assumptions.networkTrafficGB || 50,
        instanceHourlyCost: assumptions.instanceHourlyCost || 0.1,
        storageCostPerGB: assumptions.storageCostPerGB || 0.025,
        networkCostPerGB: assumptions.networkCostPerGB || 0.05,
      };
    } else {
      resolvedMetrics = {
        computeInstances: assumptions.computeInstances || 2,
        avgCpuUsage: aggregated.avgCpuUsage,
        avgMemoryUsage: aggregated.avgMemoryUsage,
        storageGB: aggregated.avgStorageUsage || 100,
        networkTrafficGB: aggregated.avgNetworkTraffic || 50,
        instanceHourlyCost: assumptions.instanceHourlyCost || 0.1,
        storageCostPerGB: assumptions.storageCostPerGB || 0.025,
        networkCostPerGB: assumptions.networkCostPerGB || 0.05,
      };
    }
  }

  const baseCost = estimateMonthlyBaseCost(resolvedMetrics, provider);
  const spikeCost = estimateSpikeCost(baseCost, trafficSpikeFactor);
  const breakdown = buildCostBreakdown(baseCost, spikeCost, trafficSpikeFactor);

  const prediction = {
    repositoryId: repositoryId || null,
    workspaceId,
    provider,
    monthlyCostEstimate: baseCost.totalCost,
    computeCost: baseCost.computeCost,
    storageCost: baseCost.storageCost,
    networkCost: baseCost.networkCost,
    spikeCostEstimate: spikeCost,
    trafficSpikeFactor: normalizeNumber(trafficSpikeFactor, 1),
    inputMetrics: resolvedMetrics,
    assumptions: {
      provider,
      baselineTraffic: "100%",
      spikeFactor: `${normalizeNumber(trafficSpikeFactor, 1)}x`,
      ...assumptions,
    },
    generatedAt: new Date(),
  };

  const saved = await CostPrediction.create(prediction);

  return {
    predictionId: String(saved._id),
    monthlyCostEstimate: baseCost.totalCost,
    spikeCostEstimate: spikeCost,
    costBreakdown: breakdown,
    inputMetrics: resolvedMetrics,
    assumptions: prediction.assumptions,
  };
}

async function getCostPredictions(workspaceId, limit = 20) {
  const predictions = await CostPrediction.find({ workspaceId })
    .sort({ generatedAt: -1 })
    .limit(limit)
    .lean();

  return predictions;
}

module.exports = {
  predictCloudCost,
  getCostPredictions,
  estimateMonthlyBaseCost,
  estimateSpikeCost,
  PRICING_MODELS,
};
