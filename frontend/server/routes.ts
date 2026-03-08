import type { Express, Response } from "express";
import type { Server } from "http";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { api } from "@shared/routes";
import {
  aiChatRequestSchema,
  analysisRuns,
  assistantMessages,
  connectRepositorySchema,
  costPredictions,
  deployRequestSchema,
  deployments,
  incidents,
  infrastructureConfigs,
  monitoringAlerts,
  pipelines,
  predictions,
  repositories,
  runAnalysisRequestSchema,
  runSimulationRequestSchema,
  simulationMetrics,
  simulationRuns,
  simulationStageValues,
  trafficProfiles,
  type DependencyGraphPayload,
  type DashboardDataResponse,
  type PipelineStagePayload,
  type Repository,
} from "@shared/schema";

import {
  ensureWorkspace,
  getGitHubToken,
  loadRepositoryForWorkspace,
  requireWorkspace,
  verifyAuth0Token,
} from "./auth";
import { db } from "./db";

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  owner: { login: string };
  pushed_at: string;
};

type GitHubTree = {
  tree?: Array<{ path: string; type: "blob" | "tree" }>;
};

type SimulationPoint = {
  stage: (typeof simulationStageValues)[number];
  traffic: number;
  cpuUsage: number;
  memoryUsage: number;
  latencyMs: number;
  errorRate: number;
};

type RiskPrediction = {
  riskType: string;
  service: string;
  probability: number;
  suggestion: string;
  severity: "low" | "medium" | "high";
};

type AnalysisRunRow = typeof analysisRuns.$inferSelect;
type InfrastructureConfigRow = typeof infrastructureConfigs.$inferSelect;
type TrafficProfileRow = typeof trafficProfiles.$inferSelect;
type AssistantConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantContext = {
  repository: {
    id: string;
    fullName: string;
    branch: string;
  } | null;
  dashboard?: DashboardDataResponse;
  analysis?: AnalysisRunRow | null;
  infrastructure?: InfrastructureConfigRow | null;
  traffic?: TrafficProfileRow | null;
  recentMessages?: AssistantConversationMessage[];
};

const protectedMiddleware = [verifyAuth0Token, ensureWorkspace, requireWorkspace] as const;

const FALLBACK_STAGES: PipelineStagePayload[] = [
  { name: "Build", status: "success", durationSec: 126, failRate: 1.5 },
  { name: "Test", status: "success", durationSec: 238, failRate: 4.2 },
  { name: "Security Scan", status: "success", durationSec: 152, failRate: 1.8 },
  { name: "Container Build", status: "success", durationSec: 174, failRate: 1.1 },
  { name: "Deploy", status: "running", durationSec: 74, failRate: 0.6 },
];

const FALLBACK_GRAPH: DependencyGraphPayload = {
  nodes: [
    { id: "frontend", label: "Frontend", tier: "frontend" },
    { id: "gateway", label: "API Gateway", tier: "gateway" },
    { id: "auth", label: "Auth Service", tier: "service" },
    { id: "payment", label: "Payment Service", tier: "service" },
    { id: "database", label: "Database", tier: "data" },
    { id: "cache", label: "Cache", tier: "data" },
  ],
  edges: [
    { source: "frontend", target: "gateway" },
    { source: "gateway", target: "auth" },
    { source: "gateway", target: "payment" },
    { source: "auth", target: "database" },
    { source: "payment", target: "database" },
    { source: "payment", target: "cache" },
  ],
};

const LEGACY_ANALYZE_SCHEMA = z.object({ repo: z.string().min(1) });
const AI_TTS_REQUEST_SCHEMA = z.object({
  text: z.string().trim().min(1).max(2000),
  voiceId: z.string().trim().min(1).optional(),
});

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const avg = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
const paramValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function parseValidationError(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: error.errors[0]?.message ?? "Validation error",
      field: error.errors[0]?.path.join("."),
    });
  }
  return null;
}

function severity(probability: number): "low" | "medium" | "high" {
  if (probability >= 70) return "high";
  if (probability >= 45) return "medium";
  return "low";
}

function scoreStatus(score: number): string {
  if (score >= 85) return "SAFE TO DEPLOY";
  if (score >= 70) return "REVIEW REQUIRED";
  return "HIGH RISK";
}

function detectTechnologies(paths: string[], packageJson?: Record<string, unknown>): string[] {
  const files = paths.map((path) => path.toLowerCase());
  const deps = new Set(
    Object.keys({
      ...((packageJson?.dependencies as Record<string, unknown> | undefined) ?? {}),
      ...((packageJson?.devDependencies as Record<string, unknown> | undefined) ?? {}),
    }).map((dependency) => dependency.toLowerCase()),
  );

  const list = new Set<string>();
  if (files.some((path) => path.includes("next.config")) || deps.has("next")) list.add("Next.js");
  if (files.some((path) => path.endsWith("package.json")) || deps.has("express")) list.add("Node.js");
  if (files.some((path) => path.endsWith(".py") || path.endsWith("requirements.txt"))) list.add("Python");
  if (files.some((path) => path.includes("dockerfile"))) list.add("Docker");
  if (files.some((path) => path.includes("postgres")) || deps.has("pg")) list.add("PostgreSQL");
  if (files.some((path) => path.includes("redis") || path.includes("cache")) || deps.has("redis")) list.add("Redis");
  if (list.size === 0) list.add("Node.js");
  return Array.from(list);
}

function detectServices(paths: string[]): string[] {
  const files = paths.map((path) => path.toLowerCase());
  const services = new Set<string>();
  if (files.some((path) => /(frontend|client|web|ui)/.test(path))) services.add("Frontend");
  if (files.some((path) => /(gateway|api)/.test(path))) services.add("API Gateway");
  if (files.some((path) => /(auth|oauth|identity)/.test(path))) services.add("Auth Service");
  if (files.some((path) => /(payment|billing|checkout)/.test(path))) services.add("Payment Service");
  if (files.some((path) => /(postgres|database|prisma|sql)/.test(path))) services.add("Database");
  if (files.some((path) => /(redis|cache)/.test(path))) services.add("Cache");

  return services.size
    ? Array.from(services)
    : ["Frontend", "API Gateway", "Auth Service", "Payment Service", "Database", "Cache"];
}

function buildGraph(services: string[]): DependencyGraphPayload {
  const idMap: Record<string, string> = {
    Frontend: "frontend",
    "API Gateway": "gateway",
    "Auth Service": "auth",
    "Payment Service": "payment",
    Database: "database",
    Cache: "cache",
  };

  const nodes = services.map((service) => ({
    id: idMap[service] ?? service.toLowerCase().replace(/\s+/g, "-"),
    label: service,
    tier:
      service === "Frontend"
        ? "frontend"
        : service === "API Gateway"
          ? "gateway"
          : service === "Database" || service === "Cache"
            ? "data"
            : "service",
  })) as DependencyGraphPayload["nodes"];

  const ids = new Set(nodes.map((node) => node.id));
  const edges = FALLBACK_GRAPH.edges.filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );

  return {
    nodes: nodes.length ? nodes : FALLBACK_GRAPH.nodes,
    edges: edges.length ? edges : FALLBACK_GRAPH.edges,
  };
}

function buildStages(paths: string[]): PipelineStagePayload[] {
  const files = paths.map((path) => path.toLowerCase());
  const hasPipelineFile = files.some(
    (path) =>
      path.startsWith(".github/workflows") ||
      path.endsWith(".gitlab-ci.yml") ||
      path.endsWith("jenkinsfile"),
  );
  if (!hasPipelineFile) return FALLBACK_STAGES;

  const seed = hashString(paths.slice(0, 8).join("|"));
  return FALLBACK_STAGES.map((stage, index) => {
    const drift = ((seed + index * 11) % 17) - 8;
    return {
      ...stage,
      durationSec: clamp((stage.durationSec ?? 120) + drift, 48, 420),
      failRate: Number(clamp((stage.failRate ?? 1) + drift * 0.04, 0.2, 12).toFixed(1)),
    };
  });
}

function parseNumericToken(raw: string) {
  const match = raw.match(/(\d+(\.\d+)?)/);
  if (!match) return Number.NaN;
  return Number.parseFloat(match[1]);
}

function parseCpuCores(raw?: string | null) {
  if (!raw) return 2;
  const normalized = raw.trim().toLowerCase();
  const value = parseNumericToken(normalized);
  if (!Number.isFinite(value) || value <= 0) return 2;

  if (normalized.includes("m") && !normalized.includes("mb")) {
    return clamp(value / 1000, 0.1, 64);
  }
  return clamp(value, 0.25, 64);
}

function parseMemoryGb(raw?: string | null) {
  if (!raw) return 4;
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
  const value = parseNumericToken(normalized);
  if (!Number.isFinite(value) || value <= 0) return 4;

  if (normalized.includes("ti") || normalized.includes("tb")) return clamp(value * 1024, 0.25, 2048);
  if (normalized.includes("gi") || normalized.includes("gb") || normalized.endsWith("g")) {
    return clamp(value, 0.25, 2048);
  }
  if (normalized.includes("mi") || normalized.includes("mib")) return clamp(value / 1024, 0.25, 2048);
  if (normalized.includes("mb")) return clamp(value / 1000, 0.25, 2048);
  if (normalized.includes("ki") || normalized.includes("kib")) {
    return clamp(value / (1024 * 1024), 0.25, 2048);
  }
  if (normalized.includes("kb")) return clamp(value / (1000 * 1000), 0.25, 2048);
  return clamp(value, 0.25, 2048);
}

function buildSimulation(input: {
  repoId: string;
  profile: "standard" | "stress" | "soak";
  infrastructure?: InfrastructureConfigRow | null;
  traffic?: TrafficProfileRow | null;
}): SimulationPoint[] {
  const seed = hashString(
    [
      input.repoId,
      input.profile,
      input.infrastructure?.provider ?? "aws",
      input.infrastructure?.cpuAllocation ?? "2",
      input.infrastructure?.memoryAllocation ?? "4gb",
      String(input.infrastructure?.replicaCount ?? 3),
      String(input.infrastructure?.autoscalingEnabled ?? true),
      String(input.traffic?.averageUsersPerMinute ?? 2000),
      String(input.traffic?.peakUsers ?? 10000),
      String(input.traffic?.growthPercentage ?? 15),
    ].join(":"),
  );

  const replicaCount = clamp(Math.round(input.infrastructure?.replicaCount ?? 3), 1, 60);
  const autoscalingEnabled = input.infrastructure?.autoscalingEnabled ?? true;
  const cpuPerReplica = parseCpuCores(input.infrastructure?.cpuAllocation);
  const memoryPerReplicaGb = parseMemoryGb(input.infrastructure?.memoryAllocation);
  const totalCpuCores = cpuPerReplica * replicaCount;
  const totalMemoryGb = memoryPerReplicaGb * replicaCount;
  const autoscalingHeadroom = autoscalingEnabled ? 1.32 : 1;

  const avgUsersPerMinute = clamp(input.traffic?.averageUsersPerMinute ?? 2000, 200, 500000);
  const peakUsers = clamp(
    input.traffic?.peakUsers ?? 10000,
    Math.round(avgUsersPerMinute * 1.1),
    1000000,
  );
  const growthPercentage = clamp(input.traffic?.growthPercentage ?? 15, 1, 400);
  const profileMultiplier =
    input.profile === "stress" ? 1.24 : input.profile === "soak" ? 1.12 : 1;

  const computeCapacity = totalCpuCores * 470 * autoscalingHeadroom;
  const memoryCapacity = totalMemoryGb * 240 * autoscalingHeadroom;
  const effectiveCapacity = Math.max(
    400,
    Math.min(computeCapacity, memoryCapacity) * (1 + growthPercentage / 520),
  );

  const stages: Array<{
    stage: SimulationPoint["stage"];
    traffic: number;
    pressureFactor: number;
  }> = [
    {
      stage: "Warmup",
      traffic: Math.round(avgUsersPerMinute * 0.64 * profileMultiplier),
      pressureFactor: 0.88,
    },
    {
      stage: "Spike",
      traffic: Math.round(
        peakUsers * (input.profile === "stress" ? 1.14 : input.profile === "soak" ? 1.06 : 1),
      ),
      pressureFactor: 1.38,
    },
    {
      stage: "Steady",
      traffic: Math.round(
        avgUsersPerMinute * (1 + growthPercentage / 100 * 0.44) * profileMultiplier,
      ),
      pressureFactor: 1.04,
    },
    {
      stage: "Recovery",
      traffic: Math.round(avgUsersPerMinute * 0.76 * profileMultiplier),
      pressureFactor: 0.8,
    },
  ];

  return stages.map((stage, index) => {
    const jitter = ((seed >> ((index + 1) * 5)) % 13) - 6;
    const pressure = Math.max(
      0.18,
      (stage.traffic / Math.max(1, effectiveCapacity)) * stage.pressureFactor,
    );

    const cpuUsage = Math.round(
      clamp(pressure * 67 + (replicaCount < 3 ? 8 : 0) + jitter * 0.8, 8, 100),
    );
    const memoryUsage = Math.round(
      clamp(
        pressure * 61 +
          growthPercentage * 0.06 +
          (autoscalingEnabled ? -4 : 6) +
          jitter * 0.7,
        8,
        100,
      ),
    );
    const latencyMs = Math.round(
      clamp(
        72 +
          pressure * 165 +
          Math.max(0, cpuUsage - 75) * 2.2 +
          Math.max(0, memoryUsage - 78) * 1.9 +
          jitter * 3,
        35,
        450,
      ),
    );
    const errorRate = Number(
      clamp(
        0.15 +
          Math.max(0, pressure - 0.5) * 2.8 +
          Math.max(0, cpuUsage - 80) * 0.05 +
          Math.max(0, memoryUsage - 84) * 0.045 +
          (stage.stage === "Spike" ? 0.35 : 0) +
          (autoscalingEnabled ? -0.12 : 0.05) +
          jitter * 0.02,
        0.05,
        12,
      ).toFixed(2),
    );

    return {
      stage: stage.stage,
      traffic: stage.traffic,
      cpuUsage,
      memoryUsage,
      latencyMs,
      errorRate,
    };
  });
}

function buildPredictions(
  points: SimulationPoint[],
  context?: {
    infrastructure?: InfrastructureConfigRow | null;
    traffic?: TrafficProfileRow | null;
  },
): RiskPrediction[] {
  const spike = points.find((point) => point.stage === "Spike") ?? points[1];
  const steady = points.find((point) => point.stage === "Steady") ?? points[0];
  const autoscalingEnabled = context?.infrastructure?.autoscalingEnabled ?? true;
  const memoryAllocation = context?.infrastructure?.memoryAllocation ?? "4GB";
  const peakUsers = context?.traffic?.peakUsers ?? spike.traffic;

  const memory = clamp(
    Math.round(spike.memoryUsage * 0.92 + steady.errorRate * 9 + (autoscalingEnabled ? -6 : 8)),
    12,
    98,
  );
  const dependency = clamp(
    Math.round(steady.errorRate * 19 + steady.cpuUsage * 0.35 + spike.errorRate * 4),
    10,
    96,
  );
  const database = clamp(
    Math.round(
      steady.latencyMs * 0.34 +
        spike.cpuUsage * 0.25 +
        (spike.traffic / Math.max(1, peakUsers)) * 8 -
        16,
    ),
    14,
    97,
  );
  const network = clamp(
    Math.round(spike.latencyMs * 0.3 + steady.errorRate * 13 + (autoscalingEnabled ? 0 : 12)),
    12,
    98,
  );

  return [
    {
      riskType: "Memory Saturation",
      service: "Payment Service",
      probability: memory,
      suggestion: `Increase memory from ${memoryAllocation} and tune autoscaling headroom.`,
      severity: severity(memory),
    },
    {
      riskType: "Dependency Failure",
      service: "Auth Service",
      probability: dependency,
      suggestion: "Pin critical dependencies, add retries, and enable circuit breaker fallback.",
      severity: severity(dependency),
    },
    {
      riskType: "Database Overload",
      service: "Primary PostgreSQL",
      probability: database,
      suggestion: `Scale read replicas for ~${peakUsers.toLocaleString()} peak users and optimize write-heavy queries.`,
      severity: severity(database),
    },
    {
      riskType: autoscalingEnabled ? "Network Latency" : "Autoscaling Exhaustion",
      service: autoscalingEnabled ? "API Gateway" : "Compute Cluster",
      probability: network,
      suggestion: autoscalingEnabled
        ? "Use edge caching and reduce blocking middleware in request path."
        : "Enable autoscaling and increase baseline replicas for burst workloads.",
      severity: severity(network),
    },
  ];
}

function buildCost(input: {
  points: SimulationPoint[];
  profile: "standard" | "stress" | "soak";
  infrastructure?: InfrastructureConfigRow | null;
  traffic?: TrafficProfileRow | null;
}) {
  const providerKey = (input.infrastructure?.provider ?? "aws").toLowerCase();
  const providerBase: Record<string, number> = {
    aws: 220,
    vercel: 145,
    vultr: 132,
    kubernetes: 255,
    "docker server": 92,
    "custom server": 86,
    render: 118,
  };
  const providerCpuRate: Record<string, number> = {
    aws: 44,
    vercel: 41,
    vultr: 37,
    kubernetes: 39,
    "docker server": 31,
    "custom server": 28,
    render: 36,
  };
  const providerMemoryRate: Record<string, number> = {
    aws: 11,
    vercel: 10,
    vultr: 8.7,
    kubernetes: 9.6,
    "docker server": 7.8,
    "custom server": 7.1,
    render: 8.5,
  };

  const replicaCount = clamp(Math.round(input.infrastructure?.replicaCount ?? 3), 1, 60);
  const autoscalingEnabled = input.infrastructure?.autoscalingEnabled ?? true;
  const cpuPerReplica = parseCpuCores(input.infrastructure?.cpuAllocation);
  const memoryPerReplicaGb = parseMemoryGb(input.infrastructure?.memoryAllocation);
  const totalCpu = cpuPerReplica * replicaCount;
  const totalMemoryGb = memoryPerReplicaGb * replicaCount;

  const averageTraffic =
    input.traffic?.averageUsersPerMinute ?? Math.round(avg(input.points.map((point) => point.traffic)));
  const peakTraffic = input.traffic?.peakUsers ?? Math.max(...input.points.map((point) => point.traffic));
  const growth = input.traffic?.growthPercentage ?? 15;
  const profileMultiplier =
    input.profile === "stress" ? 1.18 : input.profile === "soak" ? 1.1 : 1;

  const avgErrorRate = avg(input.points.map((point) => point.errorRate));
  const avgLatency = avg(input.points.map((point) => point.latencyMs));
  const base = providerBase[providerKey] ?? 140;
  const cpuRate = providerCpuRate[providerKey] ?? 38;
  const memoryRate = providerMemoryRate[providerKey] ?? 9;

  const monthlyCost = Math.round(
    base +
      totalCpu * cpuRate +
      totalMemoryGb * memoryRate +
      replicaCount * 42 +
      averageTraffic * 0.034 * profileMultiplier +
      peakTraffic * 0.008 +
      growth * 11 +
      avgLatency * 1.5 +
      avgErrorRate * 175 +
      (autoscalingEnabled ? 95 : 55),
  );
  return {
    monthlyCost,
    spikeCost: Math.round(
      monthlyCost * (1.08 + profileMultiplier * 0.14) +
        peakTraffic * (autoscalingEnabled ? 0.011 : 0.018),
    ),
    currency: "USD",
  };
}

function failurePredictionScore(items: Array<{ probability: number }>) {
  if (items.length === 0) return 0;
  return clamp(Math.round(avg(items.map((item) => item.probability))), 0, 100);
}

function costPredictionScore(input: {
  cost: { monthlyCost: number; spikeCost: number };
  points: SimulationPoint[];
  traffic?: TrafficProfileRow | null;
}) {
  if (input.cost.monthlyCost <= 0) return 0;
  const spikeMultiplier = input.cost.spikeCost / input.cost.monthlyCost;
  const utilization = avg(input.points.map((point) => (point.cpuUsage + point.memoryUsage) / 2));
  const errorPenalty = avg(input.points.map((point) => point.errorRate)) * 5;
  const growthPenalty = (input.traffic?.growthPercentage ?? 15) * 0.24;
  const monthlyScalePenalty =
    Math.max(0, Math.log10(Math.max(input.cost.monthlyCost, 1)) - 3) * 11;

  const pressure =
    (spikeMultiplier - 1) * 46 +
    Math.max(0, utilization - 70) * 0.35 +
    errorPenalty +
    growthPenalty +
    monthlyScalePenalty;
  return clamp(Math.round(100 - pressure), 8, 99);
}

function remediationScore(input: {
  points: SimulationPoint[];
  predictions: Array<{ probability: number; suggestion?: string }>;
  alerts: Array<{ severity: string }>;
  autoscalingEnabled: boolean;
}) {
  if (input.points.length === 0 || input.predictions.length === 0) return 0;

  const spike = input.points.find((point) => point.stage === "Spike") ?? input.points[0];
  const recovery = input.points.find((point) => point.stage === "Recovery") ?? input.points[0];
  const latencyRecovery =
    spike.latencyMs > 0 ? ((spike.latencyMs - recovery.latencyMs) / spike.latencyMs) * 100 : 0;
  const errorRecovery =
    spike.errorRate > 0 ? ((spike.errorRate - recovery.errorRate) / spike.errorRate) * 100 : 0;
  const suggestionCoverage =
    input.predictions.filter((prediction) => Boolean(prediction.suggestion?.trim())).length /
    input.predictions.length;
  const highRiskCount = input.predictions.filter((prediction) => prediction.probability >= 70).length;
  const riskLoad = avg(input.predictions.map((prediction) => prediction.probability));
  const openAlertPenalty = input.alerts.filter((alert) => alert.severity.toLowerCase() !== "low").length * 5;

  const score =
    58 +
    latencyRecovery * 0.22 +
    errorRecovery * 0.35 +
    suggestionCoverage * 14 +
    (input.autoscalingEnabled ? 6 : 0) -
    highRiskCount * 7 -
    riskLoad * 0.22 -
    openAlertPenalty;

  return clamp(Math.round(score), 5, 99);
}

function buildAlerts(points: SimulationPoint[], risks: RiskPrediction[]) {
  const steady = points.find((point) => point.stage === "Steady") ?? points[0];
  const alerts: Array<{
    title: string;
    severity: "low" | "medium" | "high";
    metric: string;
    value: number;
    threshold: number;
    message: string;
  }> = [];

  if (steady.memoryUsage > 72) {
    alerts.push({
      title: "Payment service memory pressure",
      severity: steady.memoryUsage > 85 ? "high" : "medium",
      metric: "memory_usage",
      value: steady.memoryUsage,
      threshold: 72,
      message: "Memory usage is above threshold for Payment Service.",
    });
  }

  if (steady.errorRate > 1.8) {
    alerts.push({
      title: "Build cache miss spike",
      severity: steady.errorRate > 2.8 ? "high" : "medium",
      metric: "error_rate",
      value: steady.errorRate,
      threshold: 1.8,
      message: "Error rate increase indicates CI pipeline instability.",
    });
  }

  if (risks.every((risk) => risk.probability < 55) || alerts.length === 0) {
    alerts.push({
      title: "Security scan baseline healthy",
      severity: "low",
      metric: "security_scan",
      value: 1,
      threshold: 1,
      message: "No critical security regressions detected.",
    });
  }

  return alerts;
}

function buildTrend(points: SimulationPoint[]) {
  const now = new Date();
  const steady = points.find((point) => point.stage === "Steady") ?? points[0];
  const baseLatency = steady?.latencyMs ?? 85;
  const baseErrorRate = steady?.errorRate ?? 0.45;

  return Array.from({ length: 6 }, (_, index) => {
    const t = new Date(now.getTime() - (5 - index) * 60 * 60 * 1000);
    const hour = `${String(t.getHours()).padStart(2, "0")}:00`;
    const latency = clamp(
      Math.round(baseLatency + (index - 2.5) * 8 + (index % 2 === 0 ? -7 : 9)),
      60,
      320,
    );
    const errors = Number(
      clamp(
        baseErrorRate + (index - 2.5) * 0.12 + (index % 2 === 0 ? -0.08 : 0.11),
        0.2,
        8,
      ).toFixed(2),
    );

    return { hour, latency, errors };
  });
}

function toneForProbability(probability: number) {
  if (probability >= 85) return "critical";
  if (probability >= 70) return "warning";
  return "healthy";
}

function topRiskSummary(dashboard?: DashboardDataResponse) {
  if (!dashboard || dashboard.predictions.length === 0) {
    return "No risk predictions available.";
  }

  const top = dashboard.predictions
    .slice()
    .sort((a, b) => b.probability - a.probability)[0];
  return `${top.riskType} in ${top.service} at ${top.probability}% (${toneForProbability(top.probability)}). Suggested fix: ${top.suggestion}`;
}

function pipelineSummary(dashboard?: DashboardDataResponse) {
  if (!dashboard || dashboard.pipelineStages.length === 0) {
    return "Pipeline stage data is unavailable.";
  }

  const slowest = dashboard.pipelineStages
    .slice()
    .sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))[0];
  const risky = dashboard.pipelineStages
    .slice()
    .sort((a, b) => (b.failRate ?? 0) - (a.failRate ?? 0))[0];
  return `Slowest stage: ${slowest.name}${slowest.durationSec ? ` (${slowest.durationSec}s)` : ""}. Highest fail risk: ${risky.name}${risky.failRate !== undefined ? ` (${risky.failRate}% fail)` : ""}.`;
}

function dependencyFlowSummary(analysis?: AnalysisRunRow | null) {
  const graph = analysis?.dependencyGraph;
  if (!graph || graph.nodes.length === 0) {
    return "Dependency graph is unavailable.";
  }

  const labels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const flow = graph.edges
    .slice(0, 6)
    .map(
      (edge) =>
        `${labels.get(edge.source) ?? edge.source} -> ${labels.get(edge.target) ?? edge.target}`,
    );

  if (flow.length === 0) {
    return `${graph.nodes.length} components detected without explicit dependency edges.`;
  }

  return `${graph.nodes.length} components and ${graph.edges.length} dependencies. Key flow: ${flow.join(", ")}.`;
}

function codebaseSummary(analysis?: AnalysisRunRow | null) {
  if (!analysis) {
    return "Codebase analysis unavailable. Run repository analysis to detect technologies, services, and architecture.";
  }

  const technologies = analysis.detectedTechnologies.length
    ? analysis.detectedTechnologies.join(", ")
    : "No technologies detected";
  const services = analysis.detectedServices.length
    ? analysis.detectedServices.join(", ")
    : "No services detected";
  const pipeline = analysis.pipelineStages.length
    ? analysis.pipelineStages.map((stage) => stage.name).join(" -> ")
    : "No pipeline stages detected";
  const notes = analysis.notes?.trim() ? analysis.notes.trim() : "No additional analysis notes.";

  return `Technologies: ${technologies}. Services: ${services}. Pipeline stages: ${pipeline}. Architecture: ${dependencyFlowSummary(analysis)} Notes: ${notes}`;
}

function infrastructureSummary(context: AssistantContext) {
  const infrastructure = context.infrastructure;
  const traffic = context.traffic;

  if (!infrastructure && !traffic) {
    return "Infrastructure and traffic configuration not available.";
  }

  // Do not expose raw environment variable values to the assistant context.
  const envVarCount = infrastructure ? Object.keys(infrastructure.envVars ?? {}).length : 0;
  const infraLine = infrastructure
    ? `${infrastructure.provider}, CPU ${infrastructure.cpuAllocation}, Memory ${infrastructure.memoryAllocation}, Replicas ${infrastructure.replicaCount}, Autoscaling ${infrastructure.autoscalingEnabled ? "enabled" : "disabled"}, ${envVarCount} environment variables configured`
    : "Infrastructure not configured";
  const trafficLine = traffic
    ? `Average ${traffic.averageUsersPerMinute}/min, Peak ${traffic.peakUsers}, Growth ${traffic.growthPercentage}%`
    : "Traffic profile not configured";

  return `Infrastructure: ${infraLine}. Traffic: ${trafficLine}.`;
}

function buildOperationalRecommendations(context: AssistantContext) {
  const recommendations: string[] = [];
  const dashboard = context.dashboard;
  const topRisk = dashboard?.predictions.slice().sort((a, b) => b.probability - a.probability)[0];
  const slowestStage = dashboard?.pipelineStages
    .slice()
    .sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))[0];

  if (topRisk) {
    recommendations.push(
      `Prioritize ${topRisk.service}: ${topRisk.riskType} is at ${topRisk.probability}%. ${topRisk.suggestion}`,
    );
  }

  if (slowestStage && (slowestStage.durationSec ?? 0) >= 180) {
    recommendations.push(
      `Reduce CI latency in ${slowestStage.name}; current runtime is ${slowestStage.durationSec}s. Improve cache hit rate and parallelize long-running checks.`,
    );
  }

  if (dashboard && context.infrastructure && dashboard.metrics.costPredictionScore < 70) {
    recommendations.push(
      `Right-size ${context.infrastructure.provider} deployment. Monthly cost is $${dashboard.costPrediction.monthlyCost.toLocaleString()} with ${context.infrastructure.replicaCount} baseline replicas.`,
    );
  }

  if (dashboard && dashboard.metrics.deploymentScore < 70) {
    recommendations.push(
      `Hold production rollout until deployment score improves from ${dashboard.metrics.deploymentScore}/100 and rerun simulation after fixes.`,
    );
  }

  if (context.analysis?.detectedServices.length) {
    recommendations.push(
      `Prepare runbooks and ownership for ${context.analysis.detectedServices.slice(0, 3).join(", ")} before production cutover.`,
    );
  }

  return Array.from(new Set(recommendations)).slice(0, 4);
}

function buildFollowUpSuggestions(context: AssistantContext) {
  const dashboard = context.dashboard;
  const topRisk = dashboard?.predictions.slice().sort((a, b) => b.probability - a.probability)[0];
  const slowestStage = dashboard?.pipelineStages
    .slice()
    .sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))[0];
  const service = context.analysis?.detectedServices[0];

  return Array.from(
    new Set(
      [
        topRisk ? `How do I fix ${topRisk.riskType} in ${topRisk.service}?` : null,
        slowestStage ? `How can I speed up the ${slowestStage.name} pipeline stage?` : null,
        context.infrastructure
          ? `How can I reduce ${context.infrastructure.provider} cost for current traffic?`
          : null,
        service ? `Which ${service} code path should I harden before production?` : null,
      ].filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, 4);
}

function recentConversationSummary(messages?: AssistantConversationMessage[]) {
  if (!messages || messages.length === 0) {
    return "No prior conversation history.";
  }

  return messages
    .slice(-4)
    .map((message) => `${message.role}: ${message.content}`)
    .join(" | ");
}

function buildAnalyticsReport(context: AssistantContext) {
  const dashboard = context.dashboard;
  const recommendations = buildOperationalRecommendations(context);

  if (!dashboard && !context.analysis && !context.infrastructure && !context.traffic) {
    return [
      `Repository: ${context.repository?.fullName ?? "Not selected"}`,
      "Analytics report is not available yet. Run full analysis and simulation for this repository.",
    ].join("\n");
  }

  const alerts = dashboard?.alerts.length
    ? dashboard.alerts
        .map((alert) => `${alert.title} [${alert.severity}]`)
        .join("; ")
    : "No active alerts.";

  const spike = dashboard?.simulationStages.find((stage) => stage.stage === "Spike");

  return [
    `Repository: ${context.repository?.fullName ?? dashboard?.repository.fullName ?? "Not selected"}`,
    `Branch: ${context.repository?.branch ?? dashboard?.repository.defaultBranch ?? "unknown"}`,
    `Codebase summary: ${codebaseSummary(context.analysis)}`,
    `Infrastructure summary: ${infrastructureSummary(context)}`,
    `Failure prediction score: ${dashboard?.metrics.failurePredictionScore ?? 0}/100 (higher means higher failure risk)`,
    `Cost prediction score: ${dashboard?.metrics.costPredictionScore ?? 0}/100`,
    `Deployment confidence: ${dashboard?.metrics.deploymentScore ?? 0}/100 (${dashboard?.metrics.deploymentStatus ?? "UNKNOWN"})`,
    `Remediation readiness: ${dashboard?.metrics.remediationScore ?? 0}/100`,
    `Steady metrics: CPU ${dashboard?.metrics.cpuUsage ?? 0}%, Memory ${dashboard?.metrics.memoryUsage ?? 0}%, Latency ${dashboard?.metrics.latency ?? 0}ms, Error Rate ${dashboard?.metrics.errorRate ?? 0}%`,
    `Spike metrics: CPU ${spike?.cpuUsage ?? "NA"}%, Memory ${spike?.memoryUsage ?? "NA"}%, Latency ${spike?.latencyMs ?? "NA"}ms, Error Rate ${spike?.errorRate ?? "NA"}%`,
    `Cost forecast: Monthly $${dashboard?.costPrediction.monthlyCost.toLocaleString() ?? "0"}, Spike $${dashboard?.costPrediction.spikeCost.toLocaleString() ?? "0"} ${dashboard?.costPrediction.currency ?? "USD"}`,
    `Top risk: ${topRiskSummary(dashboard)}`,
    `Pipeline: ${pipelineSummary(dashboard)}`,
    `Alerts: ${alerts}`,
    `Recommended actions: ${recommendations.length ? recommendations.join("; ") : "No specific recommendations available."}`,
    `Recent conversation: ${recentConversationSummary(context.recentMessages)}`,
  ].join("\n");
}

function fallbackAssistantReply(message: string, context?: AssistantContext) {
  const lower = message.toLowerCase();
  const dashboard = context?.dashboard;
  const topRisk = dashboard?.predictions
    .slice()
    .sort((a, b) => b.probability - a.probability)[0];
  const recommendations = context ? buildOperationalRecommendations(context) : [];

  if (
    context?.analysis &&
    (lower.includes("codebase") ||
      lower.includes("code") ||
      lower.includes("architecture") ||
      lower.includes("service"))
  ) {
    return codebaseSummary(context.analysis);
  }

  if ((lower.includes("fail") || lower.includes("failure") || lower.includes("deploy")) && dashboard) {
    const statusLine = `Deployment confidence is ${dashboard.metrics.deploymentScore}/100 (${dashboard.metrics.deploymentStatus}), failure risk score is ${dashboard.metrics.failurePredictionScore}/100, and remediation readiness is ${dashboard.metrics.remediationScore}/100.`;
    if (topRisk) {
      return `${statusLine} Primary blocker is ${topRisk.riskType} in ${topRisk.service} (${topRisk.probability}%). Action: ${topRisk.suggestion}`;
    }
    return `${statusLine} Run a fresh simulation to generate risk predictions before deployment.`;
  }

  if (
    (lower.includes("cpu") ||
      lower.includes("memory") ||
      lower.includes("usage") ||
      lower.includes("latency") ||
      lower.includes("error")) &&
    dashboard
  ) {
    return `Current steady metrics: CPU ${dashboard.metrics.cpuUsage}%, Memory ${dashboard.metrics.memoryUsage}%, Latency ${dashboard.metrics.latency}ms, Error Rate ${dashboard.metrics.errorRate}%. Spike shows CPU ${dashboard.simulationStages.find((stage) => stage.stage === "Spike")?.cpuUsage ?? "NA"}% and Memory ${dashboard.simulationStages.find((stage) => stage.stage === "Spike")?.memoryUsage ?? "NA"}%.`;
  }

  if ((lower.includes("risk") || lower.includes("highest")) && topRisk) {
    return `${topRisk.riskType} is highest risk (${topRisk.probability}%) in ${topRisk.service}. Suggested fix: ${topRisk.suggestion}`;
  }

  if (lower.includes("fail") || lower.includes("failure")) {
    return "Payment Service shows memory growth during traffic spikes. Increase memory limits and enable autoscaling.";
  }
  if (lower.includes("cost")) {
    const cost = dashboard?.costPrediction;
    if (cost) {
      return `Estimated monthly cost is $${cost.monthlyCost.toLocaleString()} and spike cost is $${cost.spikeCost.toLocaleString()}.`;
    }
    return "Reduce cost by right-sizing worker nodes and tuning autoscaling cooldowns.";
  }
  if (lower.includes("risk")) {
    return topRisk ? `${topRisk.riskType} is highest risk (${topRisk.probability}%) in ${topRisk.service}. Suggested fix: ${topRisk.suggestion}` : "Run analysis to get latest risk prediction.";
  }
  if (lower.includes("pipeline") || lower.includes("bottleneck")) {
    if (dashboard) {
      return pipelineSummary(dashboard);
    }
    return "Pipeline bottleneck is usually in the test stage. Improve cache hit ratio and parallelize integration tests.";
  }
  if (lower.includes("alert") || lower.includes("incident")) {
    if (dashboard && dashboard.alerts.length > 0) {
      const list = dashboard.alerts.map((alert) => `${alert.title} (${alert.severity})`).join("; ");
      return `Current alerts: ${list}`;
    }
    return "No active monitoring alerts found for the selected repository.";
  }
  if (
    lower.includes("suggest") ||
    lower.includes("recommend") ||
    lower.includes("what should") ||
    lower.includes("kya karu")
  ) {
    if (recommendations.length > 0) {
      return recommendations.map((item, index) => `${index + 1}. ${item}`).join(" ");
    }
    return "Run repository analysis and simulation so I can suggest production fixes based on codebase and deployment data.";
  }
  if (dashboard) {
    return [
      `Repository ${context?.repository?.fullName ?? dashboard.repository.fullName} is currently ${dashboard.metrics.deploymentStatus} with deployment score ${dashboard.metrics.deploymentScore}/100 and remediation score ${dashboard.metrics.remediationScore}/100.`,
      topRisk ? `Top risk is ${topRisk.riskType} (${topRisk.probability}%) in ${topRisk.service}.` : "",
      `Projected monthly cost is $${dashboard.costPrediction.monthlyCost.toLocaleString()}.`,
      recommendations[0] ?? "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return "I can explain deployment risk, bottlenecks, and cloud cost optimization for your repo.";
}

async function callGemini(message: string, context: AssistantContext): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackAssistantReply(message, context);

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const analyticsReport = buildAnalyticsReport(context);
  const prompt = [
    "You are Infrabox AI DevOps Assistant for infrastructure analytics.",
    "Rules:",
    "- Use only the provided analytics report, codebase analysis, and conversation context.",
    "- Reference exact values (percentages, ms, score, USD) when relevant.",
    "- Tie every recommendation to a codebase area, service, or pipeline stage when possible.",
    "- If asked for action plan, provide short operational steps.",
    "- If asked in Hindi or Hinglish, respond in the same language style.",
    "- If data is missing, say exactly what is missing.",
    "- Keep response concise (max 160 words).",
    "",
    "Repository analytics report:",
    analyticsReport,
    "",
    "Structured dashboard context:",
    JSON.stringify(context),
    "",
    "User question:",
    message,
  ].join("\n");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 320 },
      }),
    });
    if (!response.ok) return fallbackAssistantReply(message, context);

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim();
    return text && text.length > 0 ? text : fallbackAssistantReply(message, context);
  } catch {
    return fallbackAssistantReply(message, context);
  }
}

async function synthesizeSpeechWithElevenLabs(payload: {
  text: string;
  voiceId?: string;
}): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured.");
  }

  const configuredVoiceId = payload.voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID?.trim();
  const voiceCandidates = Array.from(
    new Set(
      [
        configuredVoiceId,
        process.env.ELEVENLABS_FALLBACK_VOICE_ID?.trim(),
        // Free-friendly premade female fallback.
        "EXAVITQu4vr4xnSDxMaL",
      ].filter((voice): voice is string => Boolean(voice && voice.length > 0)),
    ),
  );
  const requestedModel = process.env.ELEVENLABS_MODEL_ID?.trim();
  const modelCandidates = Array.from(
    new Set(
      [requestedModel, "eleven_turbo_v2_5", "eleven_multilingual_v2"].filter(
        (model): model is string => Boolean(model && model.length > 0),
      ),
    ),
  );

  const errors: string[] = [];
  for (const voiceId of voiceCandidates) {
    for (const modelId of modelCandidates) {
      const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: payload.text,
          model_id: modelId,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        errors.push(`${voiceId}/${modelId}: ${response.status} ${errorBody}`);
        // paid_plan_required for voice library is voice-specific; try next voice immediately.
        if (
          response.status === 402 &&
          /paid_plan_required|library voices/i.test(errorBody)
        ) {
          break;
        }
        continue;
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      if (audioBuffer.length === 0) {
        errors.push(`${voiceId}/${modelId}: empty audio response`);
        continue;
      }
      return audioBuffer;
    }
  }

  throw new Error(`ElevenLabs TTS error: ${errors.join(" | ")}`);
}

async function githubRequest<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "infrabox-devops-app",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${body}`);
  }
  return (await response.json()) as T;
}

async function fetchGitHubRepos(token: string) {
  const data = await githubRequest<GitHubRepo[]>(
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    token,
  );

  return data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    owner: repo.owner.login,
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    default_branch: repo.default_branch,
    htmlUrl: repo.html_url,
    html_url: repo.html_url,
    private: repo.private,
    updatedAt: repo.pushed_at,
    updated_at: repo.pushed_at,
  }));
}

async function fetchRepoPaths(params: {
  owner: string;
  repo: string;
  branch: string;
  githubToken?: string | null;
}) {
  if (!params.githubToken) return [] as string[];
  try {
    const tree = await githubRequest<GitHubTree>(
      `https://api.github.com/repos/${params.owner}/${params.repo}/git/trees/${encodeURIComponent(params.branch)}?recursive=1`,
      params.githubToken,
    );
    return (tree.tree ?? []).map((item) => item.path);
  } catch {
    return [];
  }
}

async function fetchPackageJson(params: {
  owner: string;
  repo: string;
  branch: string;
  githubToken?: string | null;
}) {
  if (!params.githubToken) return undefined;
  try {
    const data = await githubRequest<{ content?: string; encoding?: string }>(
      `https://api.github.com/repos/${params.owner}/${params.repo}/contents/package.json?ref=${encodeURIComponent(params.branch)}`,
      params.githubToken,
    );
    if (!data.content || data.encoding !== "base64") return undefined;
    const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function latestAnalysis(repositoryId: string) {
  const [run] = await db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.repositoryId, repositoryId))
    .orderBy(desc(analysisRuns.startedAt))
    .limit(1);
  return run;
}

async function latestSimulation(repositoryId: string) {
  const [run] = await db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.repositoryId, repositoryId))
    .orderBy(desc(simulationRuns.createdAt))
    .limit(1);
  if (!run) return null;
  const metrics = await db
    .select()
    .from(simulationMetrics)
    .where(eq(simulationMetrics.simulationRunId, run.id));
  return { run, metrics };
}

async function latestInfrastructureConfig(repositoryId: string) {
  const [config] = await db
    .select()
    .from(infrastructureConfigs)
    .where(eq(infrastructureConfigs.repositoryId, repositoryId))
    .orderBy(desc(infrastructureConfigs.createdAt))
    .limit(1);
  return config;
}

async function latestTrafficProfile(repositoryId: string) {
  const [profile] = await db
    .select()
    .from(trafficProfiles)
    .where(eq(trafficProfiles.repositoryId, repositoryId))
    .orderBy(desc(trafficProfiles.createdAt))
    .limit(1);
  return profile;
}

async function configuredSimulationInputs(repositoryId: string) {
  const [config, traffic] = await Promise.all([
    latestInfrastructureConfig(repositoryId),
    latestTrafficProfile(repositoryId),
  ]);
  return { config, traffic };
}

async function latestAssistantMessages(repositoryId: string) {
  const rows = await db
    .select({
      role: assistantMessages.role,
      content: assistantMessages.content,
    })
    .from(assistantMessages)
    .where(eq(assistantMessages.repositoryId, repositoryId))
    .orderBy(desc(assistantMessages.createdAt))
    .limit(6);

  return rows.reverse().map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
  })) as AssistantConversationMessage[];
}

async function runWorkflow(params: {
  repository: Repository;
  workspaceId: string;
  githubToken?: string | null;
  branch?: string;
  profile?: "standard" | "stress" | "soak";
}) {
  const {
    repository,
    workspaceId,
    githubToken,
    branch = repository.defaultBranch,
    profile = "standard",
  } = params;

  const [analysis] = await db
    .insert(analysisRuns)
    .values({
      workspaceId,
      repositoryId: repository.id,
      status: "running",
      branch,
      notes: "Initializing repository analysis",
    })
    .returning();

  try {
    const paths = await fetchRepoPaths({
      owner: repository.owner,
      repo: repository.name,
      branch,
      githubToken,
    });
    const packageJson = await fetchPackageJson({
      owner: repository.owner,
      repo: repository.name,
      branch,
      githubToken,
    });

    const technologies = detectTechnologies(paths, packageJson);
    const services = detectServices(paths);
    const graph = buildGraph(services);
    const stages = buildStages(paths);

    const [doneAnalysis] = await db
      .update(analysisRuns)
      .set({
        status: "completed",
        detectedTechnologies: technologies,
        detectedServices: services,
        dependencyGraph: graph,
        pipelineStages: stages,
        notes: "Analysis completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(analysisRuns.id, analysis.id))
      .returning();

    await db
      .update(repositories)
      .set({ lastAnalyzedAt: new Date(), status: "connected", updatedAt: new Date() })
      .where(eq(repositories.id, repository.id));

    const [infrastructure, traffic] = await Promise.all([
      latestInfrastructureConfig(repository.id),
      latestTrafficProfile(repository.id),
    ]);

    const simulation = buildSimulation({
      repoId: repository.id,
      profile,
      infrastructure,
      traffic,
    });
    const risks = buildPredictions(simulation, { infrastructure, traffic });
    const cost = buildCost({ points: simulation, profile, infrastructure, traffic });
    const alerts = buildAlerts(simulation, risks);

    const steady = simulation.find((point) => point.stage === "Steady") ?? simulation[0];
    const remediScore = remediationScore({
      points: simulation,
      predictions: risks,
      alerts,
      autoscalingEnabled: infrastructure?.autoscalingEnabled ?? true,
    });
    const costScore = costPredictionScore({
      cost,
      points: simulation,
      traffic,
    });
    const deploy = deploymentScore({
      stages,
      predictions: risks,
      steady,
      remediation: remediScore,
      costScore,
    });

    await db.insert(pipelines).values({
      repositoryId: repository.id,
      name: `Pipeline - ${new Date().toISOString()}`,
      status: "running",
      confidenceScore: deploy.score,
      costPrediction: cost.monthlyCost,
      stages,
    });

    const [simRun] = await db
      .insert(simulationRuns)
      .values({
        repositoryId: repository.id,
        analysisRunId: doneAnalysis.id,
        status: "completed",
        profile,
      })
      .returning();

    await db.insert(simulationMetrics).values(
      simulation.map((point) => ({
        simulationRunId: simRun.id,
        stage: point.stage,
        traffic: point.traffic,
        cpuUsage: point.cpuUsage,
        memoryUsage: point.memoryUsage,
        latencyMs: point.latencyMs,
        errorRate: point.errorRate,
      })),
    );

    await db.insert(predictions).values(
      risks.map((risk) => ({
        repositoryId: repository.id,
        analysisRunId: doneAnalysis.id,
        riskType: risk.riskType,
        service: risk.service,
        probability: risk.probability,
        suggestion: risk.suggestion,
        severity: risk.severity,
      })),
    );

    await db.insert(costPredictions).values({
      repositoryId: repository.id,
      analysisRunId: doneAnalysis.id,
      monthlyCost: cost.monthlyCost,
      spikeCost: cost.spikeCost,
      currency: cost.currency,
    });

    await db.insert(monitoringAlerts).values(
      alerts.map((alert) => ({
        repositoryId: repository.id,
        title: alert.title,
        severity: alert.severity,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        message: alert.message,
      })),
    );

    await db.insert(incidents).values(
      alerts.map((alert) => ({
        workspaceId,
        title: alert.title,
        severity: alert.severity,
        status: "open",
        component: alert.metric,
        description: alert.message,
        suggestedAction:
          alert.metric === "memory_usage"
            ? "Increase memory limits and autoscaling headroom."
            : alert.metric === "error_rate"
              ? "Review failing stage and stabilize dependency cache."
              : "Continue monitoring baseline health.",
      })),
    );

    return {
      analysis: doneAnalysis,
      simulationRun: simRun,
      simulation,
      risks,
      cost,
    };
  } catch (error) {
    await db
      .update(analysisRuns)
      .set({
        status: "failed",
        notes: error instanceof Error ? error.message : "Analysis failed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(analysisRuns.id, analysis.id));
    throw error;
  }
}

function deploymentScore(input: {
  stages: PipelineStagePayload[];
  predictions: Array<{ probability: number }>;
  steady?: SimulationPoint;
  remediation?: number;
  costScore?: number;
}) {
  const pipelineScore = avg(
    input.stages.map((stage) =>
      stage.status === "success" ? 100 : stage.status === "running" ? 82 : stage.status === "pending" ? 68 : 40,
    ),
  );
  const riskPenalty = avg(input.predictions.map((prediction) => prediction.probability));
  const steady = input.steady;
  const simScore = steady
    ? clamp(
        100 -
          steady.latencyMs * 0.11 -
          steady.errorRate * 16 -
          Math.max(0, steady.cpuUsage - 70) * 1.1 -
          Math.max(0, steady.memoryUsage - 70) * 1.1,
        20,
        100,
      )
    : 75;
  const hasTestSuccess = input.stages.some(
    (stage) => stage.name.toLowerCase() === "test" && stage.status === "success",
  );
  const remediation = input.remediation ?? 65;
  const costScore = input.costScore ?? 60;
  const score = Math.round(
    pipelineScore * 0.33 +
      (100 - riskPenalty) * 0.27 +
      simScore * 0.2 +
      remediation * 0.1 +
      costScore * 0.05 +
      (hasTestSuccess ? 100 : 70) * 0.05,
  );
  return {
    score,
    status: scoreStatus(score),
    components: {
      pipelineScore: Math.round(pipelineScore),
      failurePredictionScore: Math.round(100 - riskPenalty),
      simulationScore: Math.round(simScore),
      remediationScore: Math.round(remediation),
      costScore: Math.round(costScore),
    },
  };
}

async function buildDashboard(repository: Repository) {
  const { config: infrastructure, traffic } = await configuredSimulationInputs(repository.id);

  let analysis = await latestAnalysis(repository.id);
  let simulation = await latestSimulation(repository.id);

  if ((!analysis || !simulation) && infrastructure && traffic) {
    const seeded = await runWorkflow({
      repository,
      workspaceId: repository.workspaceId,
      branch: repository.defaultBranch,
      profile: "standard",
    });
    analysis = seeded.analysis;
    simulation = {
      run: seeded.simulationRun,
      metrics: seeded.simulation.map((point) => ({
        id: "seeded",
        simulationRunId: seeded.simulationRun.id,
        stage: point.stage,
        traffic: point.traffic,
        cpuUsage: point.cpuUsage,
        memoryUsage: point.memoryUsage,
        latencyMs: point.latencyMs,
        errorRate: point.errorRate,
        createdAt: new Date(),
      })),
    };
  }

  const predictionRows = await db
    .select()
    .from(predictions)
    .where(eq(predictions.repositoryId, repository.id))
    .orderBy(desc(predictions.createdAt))
    .limit(4);

  const [cost] = await db
    .select()
    .from(costPredictions)
    .where(eq(costPredictions.repositoryId, repository.id))
    .orderBy(desc(costPredictions.createdAt))
    .limit(1);

  const alertRows = await db
    .select()
    .from(monitoringAlerts)
    .where(eq(monitoringAlerts.repositoryId, repository.id))
    .orderBy(desc(monitoringAlerts.createdAt))
    .limit(4);

  const points = (simulation?.metrics ?? []).map((metric) => ({
    stage: metric.stage,
    traffic: metric.traffic,
    cpuUsage: metric.cpuUsage,
    memoryUsage: metric.memoryUsage,
    latencyMs: metric.latencyMs,
    errorRate: metric.errorRate,
  })) as SimulationPoint[];

  const resolvedPoints =
    points.length > 0
      ? points
      : infrastructure && traffic
        ? buildSimulation({
            repoId: repository.id,
            profile: "standard",
            infrastructure,
            traffic,
          })
        : [];

  const steady = resolvedPoints.find((point) => point.stage === "Steady") ?? resolvedPoints[0];
  const failureScore = failurePredictionScore(predictionRows);
  const costScore = costPredictionScore({
    cost: {
      monthlyCost: cost?.monthlyCost ?? 0,
      spikeCost: cost?.spikeCost ?? 0,
    },
    points: resolvedPoints,
    traffic,
  });
  const remediScore = remediationScore({
    points: resolvedPoints,
    predictions: predictionRows,
    alerts: alertRows.map((alert) => ({ severity: alert.severity })),
    autoscalingEnabled: infrastructure?.autoscalingEnabled ?? true,
  });
  const deploy = deploymentScore({
    stages: analysis?.pipelineStages ?? [],
    predictions: predictionRows,
    steady,
    remediation: remediScore,
    costScore,
  });

  return {
    repository: {
      id: repository.id,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
    },
    metrics: {
      cpuUsage: steady?.cpuUsage ?? 0,
      memoryUsage: steady?.memoryUsage ?? 0,
      latency: steady?.latencyMs ?? 0,
      errorRate: steady?.errorRate ?? 0,
      failurePredictionScore: failureScore,
      costPredictionScore: costScore,
      deploymentScore: deploy.score,
      deploymentStatus: deploy.status,
      remediationScore: remediScore,
    },
    trend: buildTrend(resolvedPoints),
    simulationStages: resolvedPoints,
    dependencyGraph: analysis?.dependencyGraph ?? { nodes: [], edges: [] },
    pipelineStages: analysis?.pipelineStages ?? [],
    predictions: predictionRows.map((risk) => ({
      id: risk.id,
      riskType: risk.riskType,
      service: risk.service,
      probability: risk.probability,
      suggestion: risk.suggestion,
      severity: risk.severity,
    })),
    costPrediction: {
      monthlyCost: cost?.monthlyCost ?? 0,
      spikeCost: cost?.spikeCost ?? 0,
      currency: cost?.currency ?? "USD",
    },
    alerts: alertRows.map((alert) => ({
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      detail: alert.message,
      status: alert.status,
    })),
  };
}

async function repoFromIdentifier(workspaceId: string, identifier: string) {
  const byId = await loadRepositoryForWorkspace(workspaceId, identifier);
  if (byId) return byId;

  const [byName] = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.fullName, identifier)))
    .limit(1);
  return byName;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "infrabox-api" });
  });

  app.get(api.auth.me.path, ...protectedMiddleware, (req, res) => {
    res.json({
      id: req.currentUser!.id,
      email: req.currentUser!.email,
      name: req.currentUser!.name,
      avatarUrl: req.currentUser!.avatarUrl,
      workspaceId: req.currentWorkspace!.id,
    });
  });

  app.get(api.users.me.path, ...protectedMiddleware, (req, res) => {
    res.json(req.currentUser);
  });

  app.get(api.workspaces.current.path, ...protectedMiddleware, (req, res) => {
    res.json(req.currentWorkspace);
  });

  app.get(api.github.repos.path, ...protectedMiddleware, async (req, res) => {
    const token = getGitHubToken(req);
    if (!token) {
      return res.status(400).json({
        message:
          "GitHub token missing. Configure Auth0 GitHub token claim or pass x-github-token header.",
      });
    }

    try {
      const repos = await fetchGitHubRepos(token);
      return res.json(repos);
    } catch (error) {
      return res.status(502).json({
        message: error instanceof Error ? error.message : "Failed to fetch GitHub repos",
      });
    }
  });

  app.get(api.repositories.list.path, ...protectedMiddleware, async (req, res) => {
    const rows = await db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, req.currentWorkspace!.id))
      .orderBy(desc(repositories.updatedAt));
    return res.json(rows);
  });

  app.post(api.repositories.connect.path, ...protectedMiddleware, async (req, res) => {
    try {
      const payload = connectRepositorySchema.parse(req.body);
      const [repository] = await db
        .insert(repositories)
        .values({
          workspaceId: req.currentWorkspace!.id,
          owner: payload.owner,
          name: payload.name,
          fullName: payload.fullName,
          provider: "github",
          defaultBranch: payload.defaultBranch,
          url: payload.url,
          githubRepoId: payload.githubRepoId,
          status: "connected",
          lastCommitSha: payload.lastCommitSha,
          lastCommitAt: payload.lastCommitAt ? new Date(payload.lastCommitAt) : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [repositories.workspaceId, repositories.fullName],
          set: {
            owner: payload.owner,
            name: payload.name,
            defaultBranch: payload.defaultBranch,
            url: payload.url,
            githubRepoId: payload.githubRepoId,
            status: "connected",
            lastCommitSha: payload.lastCommitSha,
            lastCommitAt: payload.lastCommitAt ? new Date(payload.lastCommitAt) : null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return res.status(201).json(repository);
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({ message: "Unable to connect repository" });
    }
  });

  app.post(api.analysis.run.path, ...protectedMiddleware, async (req, res) => {
    try {
      const payload = runAnalysisRequestSchema.parse(req.body);
      const repository = await loadRepositoryForWorkspace(
        req.currentWorkspace!.id,
        payload.repositoryId,
      );
      if (!repository) return res.status(404).json({ message: "Repository not found" });
      const { config, traffic } = await configuredSimulationInputs(payload.repositoryId);
      if (!config || !traffic) {
        return res.status(400).json({
          message: "Infrastructure and traffic profile configuration required",
        });
      }

      const result = await runWorkflow({
        repository,
        workspaceId: req.currentWorkspace!.id,
        githubToken: getGitHubToken(req),
        branch: payload.branch ?? repository.defaultBranch,
      });

      return res.json({
        runId: result.analysis.id,
        status: result.analysis.status,
        repositoryId: repository.id,
      });
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Analysis run failed",
      });
    }
  });

  app.post(api.simulations.run.path, ...protectedMiddleware, async (req, res) => {
    try {
      const payload = runSimulationRequestSchema.parse(req.body);
      const repository = await loadRepositoryForWorkspace(
        req.currentWorkspace!.id,
        payload.repositoryId,
      );
      if (!repository) return res.status(404).json({ message: "Repository not found" });
      const { config, traffic } = await configuredSimulationInputs(payload.repositoryId);
      if (!config || !traffic) {
        return res.status(400).json({
          message: "Infrastructure and traffic profile configuration required",
        });
      }

      const result = await runWorkflow({
        repository,
        workspaceId: req.currentWorkspace!.id,
        githubToken: getGitHubToken(req),
        profile: payload.profile,
      });

      return res.json({
        runId: result.simulationRun.id,
        status: result.simulationRun.status,
        repositoryId: repository.id,
      });
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Simulation run failed",
      });
    }
  });

  app.post(api.infrastructure.configure.path, ...protectedMiddleware, async (req, res) => {
    try {
      const payload = api.infrastructure.configure.input.parse(req.body);
      const repository = await loadRepositoryForWorkspace(
        req.currentWorkspace!.id,
        payload.repositoryId,
      );
      if (!repository) return res.status(404).json({ message: "Repository not found" });

      // Insert infrastructure config
      const [config] = await db
        .insert(infrastructureConfigs)
        .values({
          repositoryId: payload.repositoryId,
          provider: payload.provider,
          cpuAllocation: payload.cpuAllocation,
          memoryAllocation: payload.memoryAllocation,
          replicaCount: payload.replicaCount,
          autoscalingEnabled: payload.autoscalingEnabled,
          envVars: payload.envVars,
        })
        .returning();

      // Insert traffic profile
      const [profile] = await db
        .insert(trafficProfiles)
        .values({
          repositoryId: payload.repositoryId,
          averageUsersPerMinute: payload.averageUsersPerMinute,
          peakUsers: payload.peakUsers,
          growthPercentage: payload.growthPercentage,
        })
        .returning();

      return res.status(201).json({
        configId: config.id,
        repositoryId: repository.id,
      });
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Infrastructure configuration failed",
      });
    }
  });

  app.post(api.analysis.start.path, ...protectedMiddleware, async (req, res) => {
    try {
      const payload = api.analysis.start.input.parse(req.body);
      const repository = await loadRepositoryForWorkspace(
        req.currentWorkspace!.id,
        payload.repositoryId,
      );
      if (!repository) return res.status(404).json({ message: "Repository not found" });

      // Require both infra and traffic inputs so simulation is generated from configured deployment data.
      const { config, traffic } = await configuredSimulationInputs(payload.repositoryId);
      if (!config || !traffic) {
        return res.status(400).json({
          message: "Infrastructure and traffic profile configuration required",
        });
      }

      // Trigger actual analysis process with simulation
      const result = await runWorkflow({
        repository,
        workspaceId: req.currentWorkspace!.id,
        githubToken: getGitHubToken(req),
      });

      return res.json({
        runId: result.analysis.id,
        status: result.analysis.status,
        repositoryId: repository.id,
      });
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Analysis start failed",
      });
    }
  });

  app.get(api.analysis.latest.path, ...protectedMiddleware, async (req, res) => {
    const repository = await repoFromIdentifier(
      req.currentWorkspace!.id,
      paramValue(req.params.repositoryId),
    );
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const run = await latestAnalysis(repository.id);
    if (!run) return res.status(404).json({ message: "No analysis run found" });
    return res.json(run);
  });

  app.get(api.simulations.latest.path, ...protectedMiddleware, async (req, res) => {
    const repository = await repoFromIdentifier(
      req.currentWorkspace!.id,
      paramValue(req.params.repositoryId),
    );
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const run = await latestSimulation(repository.id);
    if (!run) return res.status(404).json({ message: "No simulation run found" });
    return res.json(run);
  });

  app.get(api.predictions.latest.path, ...protectedMiddleware, async (req, res) => {
    const repository = await repoFromIdentifier(
      req.currentWorkspace!.id,
      paramValue(req.params.repositoryId),
    );
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const rows = await db
      .select()
      .from(predictions)
      .where(eq(predictions.repositoryId, repository.id))
      .orderBy(desc(predictions.createdAt))
      .limit(12);
    return res.json(rows);
  });

  app.get(api.costs.latest.path, ...protectedMiddleware, async (req, res) => {
    const repository = await repoFromIdentifier(
      req.currentWorkspace!.id,
      paramValue(req.params.repositoryId),
    );
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const [cost] = await db
      .select()
      .from(costPredictions)
      .where(eq(costPredictions.repositoryId, repository.id))
      .orderBy(desc(costPredictions.createdAt))
      .limit(1);
    if (!cost) return res.status(404).json({ message: "No cost prediction found" });
    return res.json(cost);
  });

  app.get(api.dashboard.get.path, ...protectedMiddleware, async (req, res) => {
    const repository = await repoFromIdentifier(
      req.currentWorkspace!.id,
      paramValue(req.params.repositoryId),
    );
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const dashboard = await buildDashboard(repository);
    return res.json(dashboard);
  });

  app.post(api.deploy.run.path, ...protectedMiddleware, async (req, res) => {
    try {
      const payload = deployRequestSchema.parse(req.body);
      const repository = await loadRepositoryForWorkspace(
        req.currentWorkspace!.id,
        payload.repositoryId,
      );
      if (!repository) return res.status(404).json({ message: "Repository not found" });

      const dashboard = await buildDashboard(repository);
      const [deployment] = await db
        .insert(deployments)
        .values({
          repositoryId: repository.id,
          provider: payload.provider,
          environment: payload.environment,
          status: dashboard.metrics.deploymentScore >= 70 ? "success" : "blocked",
          confidenceScore: dashboard.metrics.deploymentScore,
          details: {
            deploymentStatus: dashboard.metrics.deploymentStatus,
            failurePredictionScore: dashboard.metrics.failurePredictionScore,
            costPredictionScore: dashboard.metrics.costPredictionScore,
            remediationScore: dashboard.metrics.remediationScore,
            message:
              dashboard.metrics.deploymentScore >= 70
                ? `Deployment simulated on ${payload.provider}.`
                : "Deployment blocked due to high-risk signals.",
          },
        })
        .returning();

      return res.json({
        deploymentId: deployment.id,
        status: deployment.status,
        provider: deployment.provider,
        environment: deployment.environment,
      });
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({ message: "Unable to simulate deployment" });
    }
  });

  app.get(api.monitoring.get.path, ...protectedMiddleware, async (req, res) => {
    const repository = await repoFromIdentifier(
      req.currentWorkspace!.id,
      paramValue(req.params.repositoryId),
    );
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const alerts = await db
      .select()
      .from(monitoringAlerts)
      .where(eq(monitoringAlerts.repositoryId, repository.id))
      .orderBy(desc(monitoringAlerts.createdAt))
      .limit(20);
    const latest = await latestSimulation(repository.id);
    return res.json({ alerts, latest });
  });

  app.post(api.chat.send.path, ...protectedMiddleware, async (req, res) => {
    try {
      const payload = aiChatRequestSchema.parse(req.body);
      let repository: Repository | undefined;
      if (payload.repositoryId) {
        repository = await loadRepositoryForWorkspace(req.currentWorkspace!.id, payload.repositoryId);
      } else {
        [repository] = await db
          .select()
          .from(repositories)
          .where(eq(repositories.workspaceId, req.currentWorkspace!.id))
          .orderBy(desc(repositories.updatedAt))
          .limit(1);
      }

      const repositoryContext = repository
        ? {
            id: repository.id,
            fullName: repository.fullName,
            branch: repository.defaultBranch,
          }
        : null;
      const [dashboard, analysis, configuredInputs, recentMessages] = repository
        ? await Promise.all([
            buildDashboard(repository),
            latestAnalysis(repository.id),
            configuredSimulationInputs(repository.id),
            latestAssistantMessages(repository.id),
          ])
        : [undefined, null, { config: null, traffic: null }, []];
      const assistantContext: AssistantContext = {
        repository: repositoryContext,
        dashboard,
        analysis,
        infrastructure: configuredInputs.config,
        traffic: configuredInputs.traffic,
        recentMessages,
      };
      const reply = await callGemini(payload.message, assistantContext);

      await db.insert(assistantMessages).values([
        {
          repositoryId: repository?.id,
          role: "user",
          content: payload.message,
        },
        {
          repositoryId: repository?.id,
          role: "assistant",
          content: reply,
        },
      ]);

      return res.json({
        reply,
        suggestions: buildFollowUpSuggestions(assistantContext),
      });
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({ message: "Unable to process AI message" });
    }
  });

  app.post("/api/ai/tts", ...protectedMiddleware, async (req, res) => {
    try {
      const payload = AI_TTS_REQUEST_SCHEMA.parse(req.body);
      const audio = await synthesizeSpeechWithElevenLabs(payload);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.send(audio);
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      const message =
        error instanceof Error ? error.message : "Unable to synthesize ElevenLabs speech.";
      const status = message.includes("ELEVENLABS_API_KEY") ? 503 : 502;
      return res.status(status).json({ message });
    }
  });

  app.post("/api/chat", ...protectedMiddleware, async (req, res) => {
    const message = String(req.body?.message ?? "");
    if (!message) return res.status(400).json({ message: "Message is required" });
    return res.json({ reply: fallbackAssistantReply(message) });
  });

  app.get(api.pipelines.list.path, ...protectedMiddleware, async (req, res) => {
    const workspaceRepos = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.workspaceId, req.currentWorkspace!.id));
    const repoIds = workspaceRepos.map((repo) => repo.id);
    if (repoIds.length === 0) return res.json([]);
    const rows = await db
      .select()
      .from(pipelines)
      .where(inArray(pipelines.repositoryId, repoIds))
      .orderBy(desc(pipelines.createdAt));
    return res.json(rows);
  });

  app.get(api.pipelines.get.path, ...protectedMiddleware, async (req, res) => {
    const [row] = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, paramValue(req.params.id)))
      .limit(1);
    if (!row) return res.status(404).json({ message: "Pipeline not found" });
    const repository = await loadRepositoryForWorkspace(req.currentWorkspace!.id, row.repositoryId);
    if (!repository) return res.status(404).json({ message: "Pipeline not found" });
    return res.json(row);
  });

  app.get(api.incidents.list.path, ...protectedMiddleware, async (req, res) => {
    const rows = await db
      .select()
      .from(incidents)
      .where(eq(incidents.workspaceId, req.currentWorkspace!.id))
      .orderBy(desc(incidents.createdAt))
      .limit(30);
    return res.json(rows);
  });

  app.post(api.incidents.resolve.path, ...protectedMiddleware, async (req, res) => {
    const [incident] = await db
      .update(incidents)
      .set({ status: "resolved" })
      .where(
        and(
          eq(incidents.workspaceId, req.currentWorkspace!.id),
          eq(incidents.id, paramValue(req.params.id)),
        ),
      )
      .returning();
    if (!incident) return res.status(404).json({ message: "Incident not found" });
    return res.json(incident);
  });

  app.post("/analyze", ...protectedMiddleware, async (req, res) => {
    try {
      const payload = LEGACY_ANALYZE_SCHEMA.parse(req.body);
      const [repository] = await db
        .select()
        .from(repositories)
        .where(
          and(
            eq(repositories.workspaceId, req.currentWorkspace!.id),
            eq(repositories.fullName, payload.repo),
          ),
        )
        .limit(1);
      if (!repository) return res.status(404).json({ message: "Repository not connected" });
      const { config, traffic } = await configuredSimulationInputs(repository.id);
      if (!config || !traffic) {
        return res.status(400).json({
          message: "Infrastructure and traffic profile configuration required",
        });
      }
      const result = await runWorkflow({
        repository,
        workspaceId: req.currentWorkspace!.id,
        githubToken: getGitHubToken(req),
      });
      return res.status(200).json({
        status: result.analysis.status,
        repo: payload.repo,
        runId: result.analysis.id,
        message: "Repository analysis completed",
      });
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({ message: "Analysis failed" });
    }
  });

  app.get("/api/analysis", ...protectedMiddleware, async (req, res) => {
    const repoQuery = String(req.query.repo ?? "");
    const repository = repoQuery
      ? await repoFromIdentifier(req.currentWorkspace!.id, repoQuery)
      : undefined;
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const dashboard = await buildDashboard(repository);
    return res.json({
      repo: repository.fullName,
      architectureScore: clamp(
        avg(dashboard.predictions.map((risk) => 100 - risk.probability)),
        0,
        100,
      ),
      riskScore: clamp(avg(dashboard.predictions.map((risk) => risk.probability)), 0, 100),
      deploymentConfidence: dashboard.metrics.deploymentScore,
    });
  });

  app.get("/api/pipeline", ...protectedMiddleware, async (req, res) => {
    const repoQuery = String(req.query.repo ?? "");
    const repository = repoQuery
      ? await repoFromIdentifier(req.currentWorkspace!.id, repoQuery)
      : undefined;
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const analysis = await latestAnalysis(repository.id);
    return res.json({
      repo: repository.fullName,
      stages:
        analysis?.pipelineStages.map((stage) => stage.name) ??
        FALLBACK_STAGES.map((stage) => stage.name),
      slowestStage:
        analysis?.pipelineStages.slice().sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))[0]?.name ??
        "Test",
      failureProbability: Number(
        (avg(analysis?.pipelineStages.map((stage) => stage.failRate ?? 0) ?? [2]) / 100).toFixed(2),
      ),
    });
  });

  app.get("/api/simulation", ...protectedMiddleware, async (req, res) => {
    const repoQuery = String(req.query.repo ?? "");
    const repository = repoQuery
      ? await repoFromIdentifier(req.currentWorkspace!.id, repoQuery)
      : undefined;
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const simulation = await latestSimulation(repository.id);
    if (!simulation) return res.status(404).json({ message: "Simulation not found" });
    const steady =
      simulation.metrics.find((metric) => metric.stage === "Steady") ?? simulation.metrics[0];
    return res.json({
      repo: repository.fullName,
      cpu: steady.cpuUsage,
      memory: steady.memoryUsage,
      latency: steady.latencyMs,
      errorRate: steady.errorRate,
    });
  });

  app.get("/analysis", ...protectedMiddleware, async (req, res) => {
    const repoQuery = String(req.query.repo ?? "");
    const repository = repoQuery
      ? await repoFromIdentifier(req.currentWorkspace!.id, repoQuery)
      : undefined;
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const dashboard = await buildDashboard(repository);
    return res.json({
      repo: repository.fullName,
      architectureScore: clamp(
        avg(dashboard.predictions.map((risk) => 100 - risk.probability)),
        0,
        100,
      ),
      riskScore: clamp(avg(dashboard.predictions.map((risk) => risk.probability)), 0, 100),
      deploymentConfidence: dashboard.metrics.deploymentScore,
    });
  });

  app.get("/simulation", ...protectedMiddleware, async (req, res) => {
    const repoQuery = String(req.query.repo ?? "");
    const repository = repoQuery
      ? await repoFromIdentifier(req.currentWorkspace!.id, repoQuery)
      : undefined;
    if (!repository) return res.status(404).json({ message: "Repository not found" });
    const simulation = await latestSimulation(repository.id);
    if (!simulation) return res.status(404).json({ message: "Simulation not found" });
    const steady =
      simulation.metrics.find((metric) => metric.stage === "Steady") ?? simulation.metrics[0];
    return res.json({
      repo: repository.fullName,
      cpu: steady.cpuUsage,
      memory: steady.memoryUsage,
      latency: steady.latencyMs,
      errorRate: steady.errorRate,
    });
  });

  return httpServer;
}
