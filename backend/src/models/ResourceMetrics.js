/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const ResourceMetricsSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "workspaceId is required"],
      index: true,
    },
    resourceId: {
      type: String,
      required: [true, "resourceId is required"],
      trim: true,
    },
    resourceType: {
      type: String,
      required: [true, "resourceType is required"],
      trim: true,
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
    networkUsage: {
      type: Number,
      default: 0,
      min: 0,
    },
    storageUsage: {
      type: Number,
      default: 0,
      min: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
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

ResourceMetricsSchema.index({ workspaceId: 1, resourceId: 1, timestamp: -1 });

module.exports = mongoose.model("ResourceMetrics", ResourceMetricsSchema);
