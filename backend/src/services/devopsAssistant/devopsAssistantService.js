/* eslint-disable @typescript-eslint/no-require-imports */
const { Configuration, OpenAIApi } = require("openai");
const PipelineMetrics = require("../../models/PipelineMetrics");
const TechnicalDebtReport = require("../../models/TechnicalDebtReport");
const FailurePredictionResult = require("../../models/FailurePredictionResult");
const CostPrediction = require("../../models/CostPrediction");
const DeploymentConfidenceScore = require("../../models/DeploymentConfidenceScore");
const SimulationResult = require("../../models/SimulationResult");
const ResourceMetrics = require("../../models/ResourceMetrics");

const openaiApiKey = process.env.OPENAI_API_KEY;

let openai = null;

if (openaiApiKey) {
  const configuration = new Configuration({
    apiKey: openaiApiKey,
  });
  openai = new OpenAIApi(configuration);
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Intent detection patterns
const INTENT_PATTERNS = {
  deployment_failures: [
    /deployment.*fail|fail.*deploy|why.*deploy.*fail|deploy.*not.*work|deployment.*error|deploy.*error/i,
    /rollback|revert|failed.*release|release.*fail/i,
  ],
  performance: [
    /latency|slow|response.*time|performance|lag|timeout|throughput/i,
    /which.*service.*slow|bottleneck|bottlenecks|speed.*up|optimize.*performance/i,
  ],
  cost_optimization: [
    /cost|expense|price|bill|budget|expensive|reduce.*cost|save.*money|cloud.*cost/i,
    /how.*reduce.*cost|cheaper|cost.*optimization|waste.*money/i,
  ],
  pipeline_analysis: [
    /pipeline|stage|build.*fail|ci\/cd|continuous.*integration|test.*fail/i,
    /stages.*slow|which.*stage.*slow|build.*time|test.*time/i,
  ],
  security: [
    /security|vulnerab|exploit|breach|scan|secure|encrypt|permission/i,
    /threat|attack|malicious|risk.*security|security.*issue/i,
  ],
  general_infrastructure: [
    /infrastructure|config|setup|resource|capacity|load|scale/i,
    /how.*many|resource.*usage|cpu|memory|storage|network/i,
  ],
};

function detectIntent(query) {
  const lowerQuery = query.toLowerCase();

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery)) {
        return intent;
      }
    }
  }

  return "general_infrastructure";
}

async function retrieveDeploymentFailureData(workspaceId) {
  const data = {};

  try {
    const failurePredictions = await FailurePredictionResult.find({ workspaceId })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    data.recentFailures = failurePredictions.map((f) => ({
      repositoryId: f.repositoryId,
      failureProbability: normalizeNumber(f.failureProbability),
      predictedFailures: f.predictedFailures || [],
      timestamp: f.timestamp,
    }));
  } catch (err) {
    console.warn("Failed to retrieve failure predictions:", err.message);
  }

  try {
    const deploymentScores = await DeploymentConfidenceScore.find({ workspaceId })
      .sort({ evaluatedAt: -1 })
      .limit(5)
      .lean();

    data.recentDeploymentScores = deploymentScores.map((s) => ({
      repositoryId: s.repositoryId,
      confidenceScore: s.confidenceScore,
      riskLevel: s.riskLevel,
      recommendations: s.recommendations,
    }));
  } catch (err) {
    console.warn("Failed to retrieve deployment scores:", err.message);
  }

  return data;
}

async function retrievePerformanceData(workspaceId) {
  const data = {};

  try {
    const simulations = await SimulationResult.find({ workspaceId })
      .sort({ simulatedAt: -1 })
      .limit(5)
      .lean();

    data.recentSimulations = simulations.map((s) => ({
      repositoryId: s.repositoryId,
      averageLatency: normalizeNumber(s.metrics?.averageLatency),
      peakMemory: normalizeNumber(s.metrics?.peakMemory),
      successRate: normalizeNumber(s.metrics?.successRate),
    }));
  } catch (err) {
    console.warn("Failed to retrieve simulation results:", err.message);
  }

  try {
    const metrics = await ResourceMetrics.find({ workspaceId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    data.recentMetrics = metrics.map((m) => ({
      cpuUsage: normalizeNumber(m.cpuUsage),
      memoryUsage: normalizeNumber(m.memoryUsage),
      latency: normalizeNumber(m.latency),
      errorRate: normalizeNumber(m.errorRate),
    }));
  } catch (err) {
    console.warn("Failed to retrieve resource metrics:", err.message);
  }

  return data;
}

async function retrieveCostData(workspaceId) {
  const data = {};

  try {
    const costPredictions = await CostPrediction.find({ workspaceId })
      .sort({ generatedAt: -1 })
      .limit(5)
      .lean();

    data.costPredictions = costPredictions.map((c) => ({
      repositoryId: c.repositoryId,
      monthlyCostEstimate: normalizeNumber(c.monthlyCostEstimate),
      spikeCostEstimate: normalizeNumber(c.spikeCostEstimate),
      provider: c.provider,
    }));
  } catch (err) {
    console.warn("Failed to retrieve cost predictions:", err.message);
  }

  return data;
}

async function retrievePipelineData(workspaceId) {
  const data = {};

  try {
    const pipelineMetrics = await PipelineMetrics.find({ workspaceId })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    data.pipelineMetrics = pipelineMetrics.map((p) => ({
      repositoryId: p.repositoryId,
      successRate: normalizeNumber(p.successRate),
      averageBuildTime: normalizeNumber(p.averageBuildTime),
      averageTestTime: normalizeNumber(p.averageTestTime),
      failureReasons: p.failureReasons || [],
    }));
  } catch (err) {
    console.warn("Failed to retrieve pipeline metrics:", err.message);
  }

  try {
    const debtReports = await TechnicalDebtReport.find({ workspaceId })
      .sort({ timestamp: -1 })
      .limit(3)
      .lean();

    data.technicalDebt = debtReports.map((d) => ({
      repositoryId: d.repositoryId,
      totalSecurityIssues: d.totalSecurityIssues,
      criticalIssues: d.criticalIssues,
      complexity: d.averageComplexity,
    }));
  } catch (err) {
    console.warn("Failed to retrieve technical debt:", err.message);
  }

  return data;
}

async function retrieveSecurityData(workspaceId) {
  const data = {};

  try {
    const debtReports = await TechnicalDebtReport.find({ workspaceId })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    data.securityIssues = debtReports.map((d) => ({
      repositoryId: d.repositoryId,
      totalSecurityIssues: d.totalSecurityIssues,
      criticalIssues: d.criticalIssues,
      highIssues: d.highIssues,
      issuesPerModule: d.issuesPerModule || [],
    }));
  } catch (err) {
    console.warn("Failed to retrieve security data:", err.message);
  }

  return data;
}

function buildSystemPrompt(intent, supportingData) {
  let systemPrompt = `You are a DevOps expert assistant for the Infrabox platform. You provide clear, actionable insights about infrastructure, deployments, pipelines, and cloud systems. 

You have access to real-time system data and should provide specific, data-driven recommendations. Be concise but thorough. When referencing metrics, include actual values and thresholds.

Current system data context:
${JSON.stringify(supportingData, null, 2)}

Intent detected: ${intent}

Provide your response in a structured format when possible, with:
1. Direct answer to the query
2. Supporting metrics/evidence
3. Actionable recommendations
4. Risk assessment if relevant`;

  return systemPrompt;
}

async function queryOpenAI(userQuery, systemPrompt) {
  if (!openai) {
    throw new Error("OpenAI API is not configured. Set OPENAI_API_KEY environment variable.");
  }

  try {
    const response = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userQuery,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.data.choices[0]?.message?.content || "Unable to generate response";
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    throw new Error(`Failed to generate AI response: ${err.message}`);
  }
}

async function processAssistantQuery({
  workspaceId,
  query,
} = {}) {
  if (!workspaceId || !query) {
    const err = new Error("workspaceId and query are required");
    err.status = 400;
    throw err;
  }

  // Step 1: Detect intent
  const detectedIntent = detectIntent(query);

  // Step 2: Retrieve supporting data based on intent
  let supportingData = {};
  const dataSources = [];

  if (detectedIntent === "deployment_failures") {
    supportingData = await retrieveDeploymentFailureData(workspaceId);
    dataSources.push("deployment_failures", "predictions");
  } else if (detectedIntent === "performance") {
    supportingData = await retrievePerformanceData(workspaceId);
    dataSources.push("simulations", "metrics");
  } else if (detectedIntent === "cost_optimization") {
    supportingData = await retrieveCostData(workspaceId);
    dataSources.push("cost_predictions");
  } else if (detectedIntent === "pipeline_analysis") {
    supportingData = await retrievePipelineData(workspaceId);
    dataSources.push("pipeline_metrics", "technical_debt");
  } else if (detectedIntent === "security") {
    supportingData = await retrieveSecurityData(workspaceId);
    dataSources.push("security_scans", "technical_debt");
  } else {
    supportingData = {
      ...(await retrieveDeploymentFailureData(workspaceId)),
      ...(await retrievePerformanceData(workspaceId)),
      ...(await retrieveCostData(workspaceId)),
    };
    dataSources.push("general_data");
  }

  // Step 3: Build system prompt
  const systemPrompt = buildSystemPrompt(detectedIntent, supportingData);

  // Step 4: Query OpenAI
  const answer = await queryOpenAI(query, systemPrompt);

  // Step 5: Return response
  return {
    answer,
    detectedIntent,
    supportingDataSources: dataSources,
    supportingData,
  };
}

async function saveConversation({
  workspaceId,
  userId,
  userQuery,
  assistantResponse,
  detectedIntent,
  supportingDataSources,
  supportingData,
} = {}) {
  const AssistantConversation = require("../../models/AssistantConversation");

  try {
    let conversation = await AssistantConversation.findOne({
      workspaceId,
      userId,
      sessionEnded: null,
    });

    if (!conversation) {
      conversation = new AssistantConversation({
        workspaceId,
        userId,
        topic: detectedIntent,
      });
    }

    conversation.messages.push(
      {
        role: "user",
        content: userQuery,
      },
      {
        role: "assistant",
        content: assistantResponse,
        detectedIntent,
        supportingDataSources,
        supportingData,
      }
    );

    conversation.messageCount = conversation.messages.length;
    conversation.topic = detectedIntent;

    await conversation.save();
    return String(conversation._id);
  } catch (err) {
    console.warn("Failed to save conversation:", err.message);
    return null;
  }
}

async function getConversationHistory(workspaceId, limit = 10) {
  const AssistantConversation = require("../../models/AssistantConversation");

  try {
    const conversations = await AssistantConversation.find({ workspaceId })
      .sort({ sessionStarted: -1 })
      .limit(limit)
      .lean();

    return conversations;
  } catch (err) {
    console.warn("Failed to retrieve conversation history:", err.message);
    return [];
  }
}

module.exports = {
  processAssistantQuery,
  saveConversation,
  getConversationHistory,
  detectIntent,
};
