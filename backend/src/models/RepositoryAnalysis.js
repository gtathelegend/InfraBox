/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const RepositoryAnalysisSchema = new mongoose.Schema(
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
    frameworks: {
      type: [String],
      default: [],
    },
    languages: {
      type: [String],
      default: [],
    },
    services: {
      type: [String],
      default: [],
    },
    configurations: {
      type: [String],
      default: [],
    },
    summary: {
      frontend: { type: String, default: "unknown" },
      backend: { type: String, default: "unknown" },
      database: { type: String, default: "unknown" },
      cache: { type: String, default: "unknown" },
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    analyzedBy: {
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

module.exports = mongoose.model("RepositoryAnalysis", RepositoryAnalysisSchema);
