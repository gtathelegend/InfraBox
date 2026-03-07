/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const ServiceNodeSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Service node name is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Service node type is required"],
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

ServiceNodeSchema.index({ repositoryId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("ServiceNode", ServiceNodeSchema);
