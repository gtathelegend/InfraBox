/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const CostPredictionSchema = new mongoose.Schema(
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
    provider: {
      type: String,
      enum: ["aws", "gcp", "azure", "generic"],
      default: "generic",
    },
    monthlyCostEstimate: {
      type: Number,
      default: 0,
      min: 0,
    },
    computeCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    storageCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    networkCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    spikeCostEstimate: {
      type: Number,
      default: 0,
      min: 0,
    },
    trafficSpikeFactor: {
      type: Number,
      default: 1,
      min: 0,
    },
    inputMetrics: {
      type: Object,
      default: {},
    },
    assumptions: {
      type: Object,
      default: {},
    },
    generatedAt: {
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

CostPredictionSchema.index({ workspaceId: 1, generatedAt: -1 });
CostPredictionSchema.index({ repositoryId: 1, generatedAt: -1 });

module.exports = mongoose.model("CostPrediction", CostPredictionSchema);
