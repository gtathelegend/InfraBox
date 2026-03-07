/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const ActionSchema = new mongoose.Schema(
  {
    agentType: {
      type: String,
      enum: ["scaling", "healing", "cost_optimization", "pipeline_optimization"],
      required: [true, "agentType is required"],
    },
    actionName: {
      type: String,
      required: [true, "actionName is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    targetService: {
      type: String,
      trim: true,
      default: "",
    },
    parameters: {
      type: Object,
      default: {},
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["proposed", "approved", "in_progress", "completed", "failed", "rolled_back"],
      default: "proposed",
    },
    executionLog: {
      type: String,
      default: "",
    },
    result: {
      type: Object,
      default: {},
    },
    executedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

const RemediationPlanSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "workspaceId is required"],
      index: true,
    },
    triggeredBy: {
      type: String,
      enum: ["failure_prediction", "digital_twin", "manual"],
      default: "manual",
    },
    triggerContext: {
      type: Object,
      default: {},
    },
    status: {
      type: String,
      enum: ["pending", "approved", "executing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    actions: {
      type: [ActionSchema],
      default: [],
    },
    summary: {
      type: String,
      default: "",
    },
    automationEnabled: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      required: [true, "createdBy is required"],
    },
    approvedBy: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    executionStartedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

RemediationPlanSchema.index({ repositoryId: 1, status: 1 });
RemediationPlanSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("RemediationPlan", RemediationPlanSchema);
