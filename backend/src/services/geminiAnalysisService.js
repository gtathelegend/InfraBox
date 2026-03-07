const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-pro";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function ensureGeminiConfigured() {
  if (!GEMINI_API_KEY) {
    const err = new Error("GEMINI_API_KEY is not configured");
    err.status = 500;
    throw err;
  }
}

function buildJsonOnlyPrompt(instruction, payload) {
  return [
    instruction,
    "Return ONLY valid JSON. Do not include markdown fences.",
    "If information is not present, use null or empty arrays instead of inventing values.",
    "Input:",
    JSON.stringify(payload),
  ].join("\n\n");
}

function stripMarkdownFence(rawText) {
  if (!rawText) return "";
  return rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseGeminiJson(rawText) {
  const cleaned = stripMarkdownFence(rawText);

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectStart = cleaned.indexOf("{");
    const objectEnd = cleaned.lastIndexOf("}");

    if (objectStart >= 0 && objectEnd > objectStart) {
      const candidate = cleaned.slice(objectStart, objectEnd + 1);
      return JSON.parse(candidate);
    }

    const arrayStart = cleaned.indexOf("[");
    const arrayEnd = cleaned.lastIndexOf("]");

    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      const candidate = cleaned.slice(arrayStart, arrayEnd + 1);
      return JSON.parse(candidate);
    }

    throw new Error("Gemini response could not be parsed as JSON");
  }
}

async function callGeminiJson(operationName, instruction, payload) {
  ensureGeminiConfigured();

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
      contents: [
        {
          parts: [
            {
              text: buildJsonOnlyPrompt(instruction, payload),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`Gemini ${operationName} failed: ${response.status} ${errorText}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || "").join("\n").trim();

  if (!text) {
    const err = new Error(`Gemini ${operationName} returned empty content`);
    err.status = 502;
    throw err;
  }

  return parseGeminiJson(text);
}

async function analyzeArchitecture(metadata) {
  return callGeminiJson(
    "architecture analysis",
    [
      "Analyze the following repository structure.",
      "Return JSON with keys:",
      "framework, programming_languages, services, databases, caches, architecture_summary, estimated_cpu_usage, estimated_memory_usage.",
    ].join("\n"),
    {
      repoStructure: metadata.repoStructure,
      dependencies: metadata.dependencies,
      configFiles: metadata.configFiles,
    }
  );
}

async function generateDependencyGraph(metadata) {
  return callGeminiJson(
    "dependency graph",
    [
      "Analyze the project architecture and return a dependency graph.",
      "JSON format: nodes (array), edges (array of [from,to]).",
    ].join("\n"),
    {
      repoStructure: metadata.repoStructure,
      dependencies: metadata.dependencies,
      configFiles: metadata.configFiles,
    }
  );
}

async function analyzeCommitHistory(commitHistory) {
  return callGeminiJson(
    "commit history",
    [
      "Analyze the commit history.",
      "Return JSON with: most_modified_files, hotspots, recent_risky_changes, deployment_risk_areas.",
    ].join("\n"),
    {
      commitHistory,
    }
  );
}

async function analyzeCicdPipeline(pipelineFiles) {
  return callGeminiJson(
    "pipeline analysis",
    [
      "Analyze the CI/CD pipeline configuration.",
      "Return JSON with pipelineGraph having nodes, edges, and stageDurationsEstimate.",
    ].join("\n"),
    {
      pipelineFiles,
    }
  );
}

async function simulateTraffic(architectureAnalysis, infrastructure) {
  return callGeminiJson(
    "traffic simulation",
    [
      "Simulate load for 100 users, 1000 users, and 10000 users.",
      "Return JSON containing trafficScenarios with users, cpu_usage, memory_usage, latency, failure_probability, and risk.",
    ].join("\n"),
    {
      architectureAnalysis,
      infrastructure,
    }
  );
}

async function analyzeCodeOptimization(metadata) {
  return callGeminiJson(
    "code optimization",
    [
      "Identify inefficient code patterns.",
      "Return JSON with issues array containing file, problem, and solution.",
    ].join("\n"),
    {
      repoStructure: metadata.repoStructure,
      dependencies: metadata.dependencies,
      commitHistory: metadata.commitHistory,
      configFiles: metadata.configFiles,
    }
  );
}

async function generateDevopsRecommendations(context) {
  return callGeminiJson(
    "devops recommendations",
    [
      "Based on detected risks, suggest DevOps improvements.",
      "Return JSON with suggestions array.",
    ].join("\n"),
    context
  );
}

module.exports = {
  analyzeArchitecture,
  generateDependencyGraph,
  analyzeCommitHistory,
  analyzeCicdPipeline,
  simulateTraffic,
  analyzeCodeOptimization,
  generateDevopsRecommendations,
};
