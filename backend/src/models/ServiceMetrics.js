/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const ServiceMetricsSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "workspaceId is required"],
      index: true,
    },
    serviceId: {
      type: String,
      required: [true, "serviceId is required"],
      trim: true,
      index: true,
    },
    cpuUsage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    memoryUsage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
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
    traffic: {
      type: Number,
      default: 0,
      min: 0,
    },
    cloudCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    sourceBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

ServiceMetricsSchema.index({ workspaceId: 1, serviceId: 1, timestamp: -1 });

module.exports = mongoose.model("ServiceMetrics", ServiceMetricsSchema);
