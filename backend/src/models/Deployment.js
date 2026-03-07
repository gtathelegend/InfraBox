const mongoose = require("mongoose");

const DeploymentSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    version: {
      type: String,
      required: [true, "Deployment version is required"],
      trim: true,
    },
    environment: {
      type: String,
      enum: ["production", "staging", "development"],
      default: "staging",
    },
    status: {
      type: String,
      enum: ["pending", "building", "deploying", "running", "failed", "rolled_back"],
      default: "pending",
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "workspaceId is required"],
      index: true,
    },
    createdBy: {
      type: String,
      required: [true, "createdBy is required"],
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    deploymentUrl: {
      type: String,
      default: null,
      trim: true,
    },
    targetEnvironment: {
      type: String,
      enum: ["vercel", "vultr", "kubernetes", "edge"],
      default: "kubernetes",
    },
    logs: {
      type: [
        {
          timestamp: { type: Date, default: Date.now },
          event: { type: String, required: true },
          message: { type: String, default: "" },
          level: { type: String, enum: ["info", "warn", "error"], default: "info" },
          details: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
      ],
      default: [],
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

DeploymentSchema.index({ workspaceId: 1, environment: 1 });
DeploymentSchema.index({ repositoryId: 1, startedAt: -1 });

module.exports = mongoose.model("Deployment", DeploymentSchema);
