/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const AnalysisResultSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      unique: true,
      index: true,
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
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    branch: {
      type: String,
      default: "main",
      trim: true,
    },
    infrastructure: {
      provider: { type: String, required: true, trim: true },
      cpu: { type: Number, required: true, min: 1 },
      memory: { type: Number, required: true, min: 1 },
      storage: { type: Number, required: true, min: 1 },
    },
    metadataSnapshot: {
      type: Object,
      default: null,
    },
    result: {
      type: Object,
      default: null,
    },
    error: {
      message: { type: String, default: "" },
      stack: { type: String, default: "" },
      failedAt: { type: Date, default: null },
    },
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastJobId: {
      type: String,
      default: "",
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

module.exports = mongoose.model("AnalysisResult", AnalysisResultSchema);
