/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const PullRequestSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Pull request title is required"],
      trim: true,
    },
    author: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "closed", "merged", "declined"],
      default: "open",
    },
    createdAt: {
      type: Date,
      default: Date.now,
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

PullRequestSchema.index({ repositoryId: 1, createdAt: -1 });

module.exports = mongoose.model("PullRequest", PullRequestSchema);
