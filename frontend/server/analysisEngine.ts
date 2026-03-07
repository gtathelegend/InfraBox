import crypto from "node:crypto";

export type InfrastructureConfigInput = {
  provider: string;
  cpu: number;
  memoryGb: number;
  storageGb: number;
  autoscaling: boolean;
  region: string;
};

export type RepositoryInput = {
  name: string;
  url: string;
  provider: string;
  defaultBranch: string | null;
};

export type AnalysisOutput = {
  framework: string;
  backend: string;
  language: string;
  services: string[];
  dependencies: string[];
  database: string;
  cache: string;
  estimatedMemoryGb: number;
  estimatedCpuCores: number;
  pipeline: string[];
  pipelineGraph: {
    nodes: string[];
    edges: [string, string][];
  };
  serviceDependencyGraph: {
    nodes: string[];
    edges: [string, string][];
  };
};

export type SimulationScenario = {
  users: number;
  cpuUsage: string;
  memoryUsage: string;
  latency: string;
  failureProbability: string;
  risk?: string;
};

export type PreventiveSuggestion = {
  issue: string;
  solution: string;
  codeLocation: string;
};

function numericFromString(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function deterministicRepoFingerprint(repo: RepositoryInput): number {
  const hash = crypto
    .createHash("sha256")
    .update(`${repo.name}:${repo.url}:${repo.defaultBranch ?? "main"}`)
    .digest("hex");
  return Number.parseInt(hash.slice(0, 8), 16);
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : null;
}

function buildFallbackAnalysis(repo: RepositoryInput, config: InfrastructureConfigInput): AnalysisOutput {
  const fingerprint = deterministicRepoFingerprint(repo);
  const framework = repo.name.toLowerCase().includes("next") ? "Next.js" : "Node.js";
  const language = repo.name.toLowerCase().includes("python") ? "Python" : "TypeScript";
  const estimatedCpuCores = Math.max(1, Math.min(config.cpu + 1, 12));
  const estimatedMemoryGb = Math.max(2, Math.min(config.memoryGb + 1, 32));

  return {
    framework,
    backend: "Node.js",
    language,
    services: ["web", "api", "worker"],
    dependencies: ["express", "redis", "postgres"],
    database: "PostgreSQL",
    cache: "Redis",
    estimatedMemoryGb,
    estimatedCpuCores,
    pipeline: ["build", "test", "scan", "deploy"],
    pipelineGraph: {
      nodes: ["build", "test", "scan", "deploy"],
      edges: [
        ["build", "test"],
        ["test", "scan"],
        ["scan", "deploy"],
      ],
    },
    serviceDependencyGraph: {
      nodes: ["web", "api", "worker", "postgres", "redis"],
      edges: ([
        ["web", "api"],
        ["api", "postgres"],
        ["api", "redis"],
        ["worker", "postgres"],
      ] as [string, string][]).slice(0, 3 + (fingerprint % 2)),
    },
  };
}

export async function analyzeCodebase(repo: RepositoryInput, config: InfrastructureConfigInput): Promise<AnalysisOutput> {
  const prompt = [
    "Analyze the following repository architecture and return JSON only.",
    "Fields required:",
    "framework, backend, language, services, dependencies, database, cache, estimatedMemoryGb, estimatedCpuCores, pipeline, pipelineGraph{nodes,edges}, serviceDependencyGraph{nodes,edges}",
    `Repository: ${repo.name}`,
    `URL: ${repo.url}`,
    `Default branch: ${repo.defaultBranch ?? "main"}`,
    `Infrastructure: ${JSON.stringify(config)}`,
  ].join("\n");

  const raw = await callGemini(prompt);
  if (raw) {
    const maybeJson = safeJsonParse<AnalysisOutput>(raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, ""));
    if (maybeJson?.framework && Array.isArray(maybeJson.pipeline)) {
      return maybeJson;
    }
  }

  return buildFallbackAnalysis(repo, config);
}

export async function simulateTraffic(analysis: AnalysisOutput): Promise<SimulationScenario[]> {
  const prompt = [
    "Using this architecture JSON, simulate traffic and return JSON only.",
    JSON.stringify(analysis),
    "Include trafficScenarios array for users 100, 1000, 10000 with fields users,cpuUsage,memoryUsage,latency,failureProbability,risk(optional).",
  ].join("\n");

  const raw = await callGemini(prompt);
  if (raw) {
    const maybe = safeJsonParse<{ trafficScenarios?: SimulationScenario[] }>(
      raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, ""),
    );
    if (Array.isArray(maybe?.trafficScenarios) && maybe.trafficScenarios.length > 0) {
      return maybe.trafficScenarios;
    }
  }

  const users = [100, 1000, 10000];
  return users.map((count) => {
    const scale = count / 10000;
    const cpu = Math.min(99, Math.round(analysis.estimatedCpuCores * 20 + scale * 50));
    const memory = Math.round(analysis.estimatedMemoryGb * (0.8 + scale * 0.8));
    const latency = Math.round(70 + scale * 500);
    const fail = Math.min(99, Math.round(scale * 90));
    return {
      users: count,
      cpuUsage: `${cpu}%`,
      memoryUsage: `${memory}GB`,
      latency: `${latency}ms`,
      failureProbability: `${fail}%`,
      risk: fail > 80 ? "service crash" : undefined,
    };
  });
}

export function evaluateCompatibility(
  config: InfrastructureConfigInput,
  analysis: AnalysisOutput,
  scenarios: SimulationScenario[],
) {
  const peakScenario = [...scenarios]
    .sort((a, b) => b.users - a.users)
    .at(0);

  const predictedMemoryGb = Math.max(
    analysis.estimatedMemoryGb,
    numericFromString(peakScenario?.memoryUsage ?? "0"),
  );
  const predictedCpuCores = Math.max(
    analysis.estimatedCpuCores,
    Math.ceil((numericFromString(peakScenario?.cpuUsage ?? "0") / 100) * Math.max(config.cpu, 1)),
  );

  const risks: string[] = [];
  if (predictedMemoryGb > config.memoryGb) risks.push("INSUFFICIENT MEMORY");
  if (predictedCpuCores > config.cpu) risks.push("INSUFFICIENT CPU");
  if (numericFromString(peakScenario?.latency ?? "0") > 350) risks.push("HIGH LATENCY RISK");

  return {
    serverMemoryGb: config.memoryGb,
    predictedMemoryGb,
    serverCpuCores: config.cpu,
    predictedCpuCores,
    result: risks.length ? risks.join(", ") : "COMPATIBLE",
    risks,
  };
}

export async function generatePreventiveSuggestions(risks: string[]): Promise<PreventiveSuggestion[]> {
  if (!risks.length) {
    return [
      {
        issue: "No immediate infrastructure risk",
        solution: "Keep autoscaling and monitor p95 latency during peak windows",
        codeLocation: "infrastructure/monitoring",
      },
    ];
  }

  const prompt = [
    "The following issues were detected:",
    JSON.stringify(risks),
    "Provide JSON with suggestions array including issue, solution, codeLocation.",
  ].join("\n");

  const raw = await callGemini(prompt);
  if (raw) {
    const maybe = safeJsonParse<{ suggestions?: PreventiveSuggestion[] }>(
      raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, ""),
    );
    if (Array.isArray(maybe?.suggestions) && maybe.suggestions.length > 0) {
      return maybe.suggestions;
    }
  }

  return risks.map((risk) => {
    if (risk.includes("MEMORY")) {
      return {
        issue: "memory spike",
        solution: "Add Redis caching and investigate high-allocation services",
        codeLocation: "services/paymentService.ts",
      };
    }

    if (risk.includes("CPU")) {
      return {
        issue: "cpu saturation",
        solution: "Introduce worker queues and optimize heavy synchronous operations",
        codeLocation: "services/jobProcessor.ts",
      };
    }

    return {
      issue: "latency increase",
      solution: "Add connection pooling and tune API gateway timeout budgets",
      codeLocation: "server/routes.ts",
    };
  });
}
