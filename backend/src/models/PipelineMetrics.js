/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const PipelineMetricsSchema = new mongoose.Schema(
  {
    pipelineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParsedPipeline",
      required: [true, "pipelineId is required"],
      index: true,
    },
    stageName: {
      type: String,
      required: [true, "stageName is required"],
      trim: true,
    },
    executionTime: {
      type: Number,
      required: [true, "executionTime is required"],
      min: 0,
      default: 0,
    },
    duration: {
      type: Number,
      required: [true, "duration is required"],
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["success", "failed", "cancelled", "skipped", "running", "unknown"],
      default: "unknown",
      index: true,
    },
    retryCount: {
      type: Number,
      min: 0,
      default: 0,
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

PipelineMetricsSchema.index({ pipelineId: 1, stageName: 1, timestamp: -1 });

module.exports = mongoose.model("PipelineMetrics", PipelineMetricsSchema);
