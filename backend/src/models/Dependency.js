/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const DependencySchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Dependency name is required"],
      trim: true,
    },
    version: {
      type: String,
      default: "unknown",
      trim: true,
    },
    type: {
      type: String,
      default: "runtime",
      trim: true,
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

DependencySchema.index({ repositoryId: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Dependency", DependencySchema);
