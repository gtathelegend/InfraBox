/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const StageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Stage name is required"],
      trim: true,
    },
    order: {
      type: Number,
      required: [true, "Stage order is required"],
      min: 1,
    },
    dependencies: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const ParsedPipelineSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    provider: {
      type: String,
      enum: ["github_actions", "gitlab_ci", "jenkins"],
      required: [true, "provider is required"],
      index: true,
    },
    stages: {
      type: [StageSchema],
      default: [],
    },
    sourceFiles: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
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

ParsedPipelineSchema.index({ repositoryId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model("ParsedPipeline", ParsedPipelineSchema);
