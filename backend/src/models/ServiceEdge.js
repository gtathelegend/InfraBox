/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const ServiceEdgeSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    source: {
      type: String,
      required: [true, "source is required"],
      trim: true,
    },
    target: {
      type: String,
      required: [true, "target is required"],
      trim: true,
    },
    relationship: {
      type: String,
      default: "depends_on",
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

ServiceEdgeSchema.index({ repositoryId: 1, source: 1, target: 1, relationship: 1 }, { unique: true });

module.exports = mongoose.model("ServiceEdge", ServiceEdgeSchema);
