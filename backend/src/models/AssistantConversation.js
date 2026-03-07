/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const AssistantConversationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        detectedIntent: String,
        supportingDataSources: [String],
        supportingData: mongoose.Schema.Types.Mixed,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    topic: {
      type: String,
      enum: [
        "deployment_failure",
        "performance_issue",
        "cost_optimization",
        "pipeline_analysis",
        "general_devops_question",
        // Backward-compatible values
        "deployment_failures",
        "performance",
        "general_infrastructure",
        "other",
      ],
      default: "general_devops_question",
    },
    sessionStarted: {
      type: Date,
      default: Date.now,
    },
    sessionEnded: Date,
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc) {
        return {
          conversationId: doc._id,
          workspaceId: doc.workspaceId,
          userId: doc.userId,
          topic: doc.topic,
          messageCount: doc.messageCount,
          sessionStarted: doc.sessionStarted,
          sessionEnded: doc.sessionEnded,
          messages: doc.messages,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      },
    },
  }
);

AssistantConversationSchema.index({ workspaceId: 1 });
AssistantConversationSchema.index({ userId: 1 });
AssistantConversationSchema.index({ sessionStarted: -1 });
AssistantConversationSchema.index({ topic: 1 });

module.exports = mongoose.model("AssistantConversation", AssistantConversationSchema);
