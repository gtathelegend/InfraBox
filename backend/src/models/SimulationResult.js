/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const SimulationResultSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    pipelineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParsedPipeline",
      required: [true, "pipelineId is required"],
      index: true,
    },
    cpuUsage: {
      type: Number,
      default: 0,
      min: 0,
    },
    memoryUsage: {
      type: Number,
      default: 0,
      min: 0,
    },
    latency: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["success", "failed", "partial", "running"],
      default: "running",
      index: true,
    },
    logs: {
      type: [String],
      default: [],
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
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

SimulationResultSchema.index({ repositoryId: 1, timestamp: -1 });

module.exports = mongoose.model("SimulationResult", SimulationResultSchema);
