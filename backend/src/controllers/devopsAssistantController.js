/* eslint-disable @typescript-eslint/no-require-imports */
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const { hasPermission } = require("../middleware/rbac");
const {
  processAssistantQuery,
  saveConversation,
  getConversationHistory,
} = require("../services/devopsAssistant/devopsAssistantService");

function enforceAction(role, action) {
  if (!hasPermission(role, action)) {
    const err = new Error("You do not have permission to perform this action");
    err.status = 403;
    throw err;
  }
}

function handleError(res, err, fallbackMessage) {
  console.error(fallbackMessage, err);
  return res.status(err.status || 500).json({
    error: err.status && err.status < 500 ? "request_error" : "server_error",
    message: err.message || fallbackMessage,
  });
}

async function queryAssistant(req, res) {
  try {
    const { workspaceId, query } = req.body;
    const userId = req.auth.sub;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId is required",
      });
    }

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: "validation_error",
        message: "query cannot be empty",
      });
    }

    // Verify workspace access
    const { role } = await requireWorkspaceMember(workspaceId, userId);
    enforceAction(role, "view_dashboard");

    // Process query through assistant
    const assistantResponse = await processAssistantQuery({
      workspaceId,
      query,
      userId,
    });

    // Save conversation to history
    const conversationId = await saveConversation({
      workspaceId,
      userId,
      userQuery: query,
      assistantResponse: assistantResponse.answer,
      detectedIntent: assistantResponse.detectedIntent,
      supportingDataSources: assistantResponse.supportingDataSources,
      supportingData: assistantResponse.supportingData,
    });

    return res.status(200).json({
      message: "Assistant query processed",
      answer: assistantResponse.answer,
      detectedIntent: assistantResponse.detectedIntent,
      supportingDataSources: assistantResponse.supportingDataSources,
      supportingData: assistantResponse.supportingData,
      conversationId,
    });
  } catch (err) {
    return handleError(res, err, "Failed to process assistant query");
  }
}

async function getHistory(req, res) {
  try {
    const { workspaceId } = req.params;
    const { limit } = req.query;
    const userId = req.auth.sub;

    if (!workspaceId) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId is required",
      });
    }

    // Verify workspace access
    const { role } = await requireWorkspaceMember(workspaceId, userId);
    enforceAction(role, "view_dashboard");

    const history = await getConversationHistory(
      workspaceId,
      Math.min(parseInt(limit, 10) || 10, 100)
    );

    return res.status(200).json({
      message: "Conversation history retrieved",
      workspaceId,
      count: history.length,
      conversations: history,
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve conversation history");
  }
}

module.exports = {
  queryAssistant,
  getHistory,
};
