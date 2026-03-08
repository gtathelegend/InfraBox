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
  monitoringAlerts,
  pipelines,
  predictions,
  repositories,
  runAnalysisRequestSchema,
  runSimulationRequestSchema,
  simulationMetrics,
  simulationRuns,
  simulationStageValues,
  type DependencyGraphPayload,
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

function buildSimulation(repoId: string, profile: "standard" | "stress" | "soak"): SimulationPoint[] {
  const seed = hashString(`${repoId}:${profile}`);
  const m = profile === "stress" ? 1.22 : profile === "soak" ? 1.1 : 1;
  const baseCpu = 44 + (seed % 12);
  const baseMemory = 46 + ((seed >> 1) % 10);
  const baseLatency = 106 + ((seed >> 3) % 35);
  const baseError = 0.8 + ((seed % 9) * 0.06);

  const points: SimulationPoint[] = [
    { stage: "Warmup", traffic: 1200, cpuUsage: Math.round(baseCpu * 0.86 * m), memoryUsage: Math.round(baseMemory * 0.9 * m), latencyMs: Math.round(baseLatency * 0.84 * m), errorRate: Number((baseError * 0.78).toFixed(2)) },
    { stage: "Spike", traffic: 9800, cpuUsage: Math.round(baseCpu * 1.26 * m), memoryUsage: Math.round(baseMemory * 1.32 * m), latencyMs: Math.round(baseLatency * 1.44 * m), errorRate: Number((baseError * 1.82).toFixed(2)) },
    { stage: "Steady", traffic: 5200, cpuUsage: Math.round(baseCpu * 1.04 * m), memoryUsage: Math.round(baseMemory * 1.08 * m), latencyMs: Math.round(baseLatency * 1.08 * m), errorRate: Number((baseError * 1.28).toFixed(2)) },
    { stage: "Recovery", traffic: 1900, cpuUsage: Math.round(baseCpu * 0.9 * m), memoryUsage: Math.round(baseMemory * 0.95 * m), latencyMs: Math.round(baseLatency * 0.9 * m), errorRate: Number((baseError * 0.86).toFixed(2)) },
  ];

  return points.map((point) => ({
    ...point,
    cpuUsage: clamp(point.cpuUsage, 8, 100),
    memoryUsage: clamp(point.memoryUsage, 8, 100),
    latencyMs: clamp(point.latencyMs, 30, 450),
    errorRate: Number(clamp(point.errorRate, 0.1, 12).toFixed(2)),
  }));
}

function buildPredictions(points: SimulationPoint[]): RiskPrediction[] {
  const spike = points.find((point) => point.stage === "Spike") ?? points[1];
  const steady = points.find((point) => point.stage === "Steady") ?? points[0];

  const memory = clamp(Math.round(spike.memoryUsage * 0.9 + steady.errorRate * 5 - 8), 18, 96);
  const dependency = clamp(Math.round(steady.errorRate * 16 + steady.cpuUsage * 0.38), 12, 93);
  const database = clamp(Math.round(steady.latencyMs * 0.31 + spike.cpuUsage * 0.24 - 18), 15, 95);
  const network = clamp(Math.round(steady.latencyMs * 0.25 + steady.errorRate * 10 - 6), 12, 94);

  return [
    { riskType: "Memory Leak", service: "Payment Service", probability: memory, suggestion: "Increase memory limits and add autoscaling.", severity: severity(memory) },
    { riskType: "Dependency Failure", service: "Auth Service", probability: dependency, suggestion: "Pin critical dependencies and add fallback validation.", severity: severity(dependency) },
    { riskType: "Database Overload", service: "Primary PostgreSQL", probability: database, suggestion: "Add read replicas and tune write-heavy indexes.", severity: severity(database) },
    { riskType: "Network Latency", service: "API Gateway", probability: network, suggestion: "Enable edge caching and reduce blocking middleware.", severity: severity(network) },
  ];
}

function buildCost(points: SimulationPoint[]) {
  const monthlyCost = Math.round(
    1180 +
      avg(points.map((point) => point.cpuUsage)) * 10.5 +
      avg(points.map((point) => point.memoryUsage)) * 9.2 +
      avg(points.map((point) => point.latencyMs)) * 2.4 +
      avg(points.map((point) => point.errorRate)) * 180,
  );
  return {
    monthlyCost,
    spikeCost: Math.round(monthlyCost * 1.28 + points[1].traffic * 0.015),
    currency: "USD",
  };
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

  return Array.from({ length: 6 }, (_, index) => {
    const t = new Date(now.getTime() - (5 - index) * 60 * 60 * 1000);
    const hour = `${String(t.getHours()).padStart(2, "0")}:00`;
    const latency = clamp(
      Math.round(steady.latencyMs + (index - 2.5) * 8 + (index % 2 === 0 ? -7 : 9)),
      60,
      320,
    );
    const errors = Number(
      clamp(
        steady.errorRate + (index - 2.5) * 0.12 + (index % 2 === 0 ? -0.08 : 0.11),
        0.2,
        8,
      ).toFixed(2),
    );

    return { hour, latency, errors };
  });
}

function fallbackAssistantReply(message: string, context?: Awaited<ReturnType<typeof buildDashboard>>) {
  const lower = message.toLowerCase();
  if (lower.includes("fail") || lower.includes("failure")) {
    return "Payment Service shows memory growth during traffic spikes. Increase memory limits and enable autoscaling.";
  }
  if (lower.includes("cost")) {
    const cost = context?.costPrediction;
    if (cost) {
      return `Estimated monthly cost is $${cost.monthlyCost.toLocaleString()} and spike cost is $${cost.spikeCost.toLocaleString()}.`;
    }
    return "Reduce cost by right-sizing worker nodes and tuning autoscaling cooldowns.";
  }
  if (lower.includes("risk")) {
    const top = context?.predictions[0];
    if (top) {
      return `${top.riskType} is highest risk (${top.probability}%) in ${top.service}. Suggested fix: ${top.suggestion}`;
    }
  }
  if (lower.includes("pipeline") || lower.includes("bottleneck")) {
    return "Pipeline bottleneck is usually in the test stage. Improve cache hit ratio and parallelize integration tests.";
  }
  return "I can explain deployment risk, bottlenecks, and cloud cost optimization for your repo.";
}

async function callGemini(message: string, context: unknown): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackAssistantReply(message);

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = [
    "You are Infrabox AI DevOps Assistant.",
    "Be concise and operational.",
    "Context:",
    JSON.stringify(context),
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
    if (!response.ok) return fallbackAssistantReply(message);

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim();
    return text && text.length > 0 ? text : fallbackAssistantReply(message);
  } catch {
    return fallbackAssistantReply(message);
  }
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

    await db.insert(pipelines).values({
      repositoryId: repository.id,
      name: `Pipeline - ${new Date().toISOString()}`,
      status: "running",
      confidenceScore: 0,
      costPrediction: 0,
      stages,
    });

    const simulation = buildSimulation(repository.id, profile);
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

    const risks = buildPredictions(simulation);
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

    const cost = buildCost(simulation);
    await db.insert(costPredictions).values({
      repositoryId: repository.id,
      analysisRunId: doneAnalysis.id,
      monthlyCost: cost.monthlyCost,
      spikeCost: cost.spikeCost,
      currency: cost.currency,
    });

    const alerts = buildAlerts(simulation, risks);
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
  const score = Math.round(
    pipelineScore * 0.35 + (100 - riskPenalty) * 0.3 + simScore * 0.25 + (hasTestSuccess ? 100 : 70) * 0.1,
  );
  return { score, status: scoreStatus(score) };
}

async function buildDashboard(repository: Repository) {
  let analysis = await latestAnalysis(repository.id);
  let simulation = await latestSimulation(repository.id);

  if (!analysis || !simulation) {
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

  const points = simulation.metrics.map((metric) => ({
    stage: metric.stage,
    traffic: metric.traffic,
    cpuUsage: metric.cpuUsage,
    memoryUsage: metric.memoryUsage,
    latencyMs: metric.latencyMs,
    errorRate: metric.errorRate,
  })) as SimulationPoint[];

  const steady = points.find((point) => point.stage === "Steady") ?? points[0];
  const deploy = deploymentScore({
    stages: analysis.pipelineStages,
    predictions: predictionRows,
    steady,
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
      deploymentScore: deploy.score,
      deploymentStatus: deploy.status,
    },
    trend: buildTrend(points),
    simulationStages: points,
    dependencyGraph: analysis.dependencyGraph,
    pipelineStages: analysis.pipelineStages,
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

      const dashboard = repository ? await buildDashboard(repository) : undefined;
      const reply = await callGemini(payload.message, {
        repository: repository
          ? {
              id: repository.id,
              fullName: repository.fullName,
              branch: repository.defaultBranch,
            }
          : null,
        dashboard,
      });

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

      return res.json({ reply });
    } catch (error) {
      const handled = parseValidationError(res, error);
      if (handled) return handled;
      return res.status(500).json({ message: "Unable to process AI message" });
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
