const mongoose = require("mongoose");

const DeploymentSchema = new mongoose.Schema(
  {
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
      enum: ["pending", "in_progress", "succeeded", "failed", "rolled_back"],
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

module.exports = mongoose.model("Deployment", DeploymentSchema);
