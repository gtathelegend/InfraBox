/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const CommitSchema = new mongoose.Schema(
  {
    sha: {
      type: String,
      required: [true, "Commit sha is required"],
      trim: true,
    },
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    author: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    timestamp: {
      type: Date,
      required: [true, "timestamp is required"],
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

CommitSchema.index({ repositoryId: 1, sha: 1 }, { unique: true });
CommitSchema.index({ repositoryId: 1, timestamp: -1 });

module.exports = mongoose.model("Commit", CommitSchema);
