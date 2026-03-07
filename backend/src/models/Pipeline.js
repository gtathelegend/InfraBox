const mongoose = require("mongoose");

const PipelineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Pipeline name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "paused", "failed", "completed"],
      default: "active",
    },
    trigger: {
      type: String,
      enum: ["push", "pull_request", "schedule", "manual"],
      default: "push",
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

PipelineSchema.index({ workspaceId: 1, name: 1 });

module.exports = mongoose.model("Pipeline", PipelineSchema);
