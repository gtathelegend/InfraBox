/* eslint-disable @typescript-eslint/no-require-imports */
const { Configuration, OpenAIApi } = require("openai");
const {
  routeQuery,
  synthesizeContext,
  extractKeyMetrics,
  buildInsightSummary,
} = require("./devopsQueryRoutingService");
const { classifyIntent, detectIntent } = require("./intentDetectionService");
const { buildPrompt, parseLLMResponse } = require("./promptBuilderService");

const openaiApiKey = process.env.OPENAI_API_KEY;

let openai = null;

if (openaiApiKey) {
  const configuration = new Configuration({
    apiKey: openaiApiKey,
  });
  openai = new OpenAIApi(configuration);
}

async function queryOpenAI(systemPrompt, userPrompt) {
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
          content: userPrompt,
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

  // Step 4: Build structured prompts
  const prompt = buildPrompt({
    userQuestion: query,
    detectedIntent,
    contextSummary,
    keyMetrics,
    insightSummary,
    systemData: knowledge,
  });

  // Step 5: Query OpenAI
  const answer = await queryOpenAI(prompt.systemPrompt, prompt.userPrompt);
  const parsedResponse = parseLLMResponse(answer, prompt.template);

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
    parsedResponse,
    promptTemplate: prompt.template,
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
