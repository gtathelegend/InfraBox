/* eslint-disable @typescript-eslint/no-require-imports */
const { Configuration, OpenAIApi } = require("openai");
const {
  routeQuery,
  synthesizeContext,
  extractKeyMetrics,
  buildInsightSummary,
} = require("./devopsQueryRoutingService");
const { classifyIntent, detectIntent } = require("./intentDetectionService");

const openaiApiKey = process.env.OPENAI_API_KEY;

let openai = null;

if (openaiApiKey) {
  const configuration = new Configuration({
    apiKey: openaiApiKey,
  });
  openai = new OpenAIApi(configuration);
}

function buildSystemPrompt(intent, knowledge, contextSummary, keyMetrics, insightSummary) {
  let systemPrompt = `You are a DevOps expert assistant for the Infrabox platform. You provide clear, actionable insights about infrastructure, deployments, pipelines, and cloud systems.

Your approach:
1. Be concise but thorough
2. Provide data-driven analysis
3. Include metrics with actual values
4. Suggest specific, actionable recommendations
5. Highlight risks early and clearly

CONTEXT SUMMARY:
${contextSummary}

KEY METRICS:
${JSON.stringify(keyMetrics, null, 2)}

INSIGHT SUMMARY:
${JSON.stringify(insightSummary, null, 2)}

DETAILED SYSTEM DATA:
${JSON.stringify(knowledge, null, 2)}

Intent detected: ${intent}

For this query, focus on:
${getIntentGuidance(intent)}

Provide your response in a structured format when possible, with:
1. Direct answer to the query
2. Supporting metrics/evidence
3. Actionable recommendations
4. Risk assessment if relevant`;

  return systemPrompt;
}

function getIntentGuidance(intent) {
  const guidance = {
    deployment_failure:
      "- Root cause of recent deployment failures\n- Services affected\n- Risk mitigation steps",
    performance_issue:
      "- Performance bottlenecks\n- Latency and throughput issues\n- Scaling recommendations",
    cost_optimization:
      "- Cost drivers and waste\n- Optimization opportunities\n- Estimated savings",
    pipeline_analysis:
      "- Pipeline health and bottlenecks\n- Stage performance\n- Test and build optimization",
    general_devops_question:
      "- Overall system health\n- Key metrics\n- Areas needing attention",
  };

  return guidance[intent] || guidance.general_devops_question;
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
  const intentResult = classifyIntent(query);
  const detectedIntent = intentResult.intent;

  // Step 2: Route query and retrieve relevant data using intelligent routing
  const knowledge = await routeQuery({
    workspaceId,
    detectedIntent,
  });

  // Step 3: Synthesize context and extract key metrics for AI prompt
  const contextSummary = synthesizeContext(knowledge);
  const keyMetrics = extractKeyMetrics(knowledge);
  const insightSummary = buildInsightSummary(knowledge);

  // Step 4: Build enhanced system prompt with aggregated knowledge
  const enhancedPrompt = buildSystemPrompt(detectedIntent, knowledge, contextSummary, keyMetrics, insightSummary);

  // Step 5: Query OpenAI
  const answer = await queryOpenAI(query, enhancedPrompt);

  // Step 6: Return comprehensive response
  return {
    answer,
    detectedIntent,
    intentConfidence: intentResult.confidence,
    intentScores: intentResult.scores,
    supportingDataSources: knowledge.dataSources || [],
    supportingData: knowledge,
    contextSummary,
    keyMetrics,
    insightSummary,
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
