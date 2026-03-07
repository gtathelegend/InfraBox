/* eslint-disable @typescript-eslint/no-require-imports */

const SUPPORTED_INTENTS = [
  "deployment_failure",
  "pipeline_analysis",
  "cost_optimization",
  "performance_issue",
  "general_devops_question",
];

const INTENT_PROFILES = {
  deployment_failure: {
    patterns: [
      /deployment\s*(failed|fail|error|rollback|revert)/i,
      /(why|reason).*deployment.*(failed|fail)/i,
      /(release|deploy).*failed/i,
    ],
    phrases: [
      "deployment fail",
      "deployment failed",
      "failed deployment",
      "rollback",
      "release failed",
      "deploy error",
    ],
    keywords: [
      "deployment",
      "deploy",
      "release",
      "rollback",
      "revert",
      "failed",
      "error",
      "incident",
    ],
  },
  pipeline_analysis: {
    patterns: [
      /(slow|failing|failed)\s*pipeline/i,
      /which\s*pipeline\s*stage\s*(is\s*)?(slowest|slow)/i,
      /(ci|cd|ci\/cd).*?(slow|fail|stage)/i,
    ],
    phrases: [
      "slow pipeline",
      "pipeline stage",
      "pipeline failed",
      "build stage",
      "test stage",
      "ci cd",
    ],
    keywords: [
      "pipeline",
      "stage",
      "build",
      "test",
      "deploy",
      "ci",
      "cd",
      "workflow",
      "job",
      "runtime",
    ],
  },
  cost_optimization: {
    patterns: [
      /(reduce|optimize|cut|save).*cost/i,
      /cloud\s*cost/i,
      /(billing|bill|budget|expense).*(high|increase|spike)/i,
    ],
    phrases: [
      "reduce cost",
      "optimize cost",
      "cloud cost",
      "save money",
      "cut cost",
      "cost spike",
    ],
    keywords: [
      "cost",
      "billing",
      "bill",
      "budget",
      "expense",
      "spend",
      "optimize",
      "save",
      "price",
      "waste",
    ],
  },
  performance_issue: {
    patterns: [
      /(high|increased|spike).*latency/i,
      /(slow|sluggish|timeout|degraded)\s*(service|api|system)?/i,
      /which\s*service\s*(is\s*)?(slow|causing)/i,
    ],
    phrases: [
      "high latency",
      "slow service",
      "performance issue",
      "response time",
      "memory spike",
      "cpu spike",
      "bottleneck",
    ],
    keywords: [
      "latency",
      "slow",
      "performance",
      "timeout",
      "throughput",
      "bottleneck",
      "memory",
      "cpu",
      "response",
      "degraded",
    ],
  },
  general_devops_question: {
    patterns: [],
    phrases: ["devops", "infrastructure", "deployment", "monitoring"],
    keywords: ["devops", "infra", "infrastructure", "service", "system"],
  },
};

const INTENT_ALIASES = {
  deployment_failures: "deployment_failure",
  performance: "performance_issue",
  general_infrastructure: "general_devops_question",
};

function normalizeIntentName(intent) {
  if (!intent) return "general_devops_question";
  return INTENT_ALIASES[intent] || intent;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreIntent(query, profile) {
  const normalizedQuery = String(query || "").toLowerCase();
  const tokens = tokenize(query);

  let score = 0;
  const matches = [];

  for (const regex of profile.patterns) {
    if (regex.test(normalizedQuery)) {
      score += 4;
      matches.push(`pattern:${regex.source}`);
    }
  }

  for (const phrase of profile.phrases) {
    if (normalizedQuery.includes(phrase)) {
      score += 2;
      matches.push(`phrase:${phrase}`);
    }
  }

  const tokenSet = new Set(tokens);
  for (const keyword of profile.keywords) {
    if (tokenSet.has(keyword)) {
      score += 1;
      matches.push(`keyword:${keyword}`);
    }
  }

  return { score, matches };
}

function classifyIntent(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) {
    return {
      intent: "general_devops_question",
      confidence: 0,
      scores: {},
      matchedSignals: [],
    };
  }

  const scoring = {};
  let bestIntent = "general_devops_question";
  let bestScore = -1;
  let bestMatches = [];

  for (const intent of SUPPORTED_INTENTS) {
    const result = scoreIntent(cleanQuery, INTENT_PROFILES[intent]);
    scoring[intent] = result.score;

    if (result.score > bestScore) {
      bestIntent = intent;
      bestScore = result.score;
      bestMatches = result.matches;
    }
  }

  if (bestScore < 2) {
    bestIntent = "general_devops_question";
    bestMatches = [];
  }

  const maxReasonableScore = 12;
  const confidence = Math.min(1, Math.max(0, bestScore / maxReasonableScore));

  return {
    intent: bestIntent,
    confidence,
    scores: scoring,
    matchedSignals: bestMatches,
  };
}

function detectIntent(query) {
  return classifyIntent(query).intent;
}

module.exports = {
  SUPPORTED_INTENTS,
  classifyIntent,
  detectIntent,
  normalizeIntentName,
};
