/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const CloudIntegrationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "workspaceId is required"],
      index: true,
    },
    provider: {
      type: String,
      enum: ["aws", "vercel", "vultr", "kubernetes"],
      required: [true, "provider is required"],
      index: true,
    },
    credentialsEncrypted: {
      type: String,
      required: [true, "credentialsEncrypted is required"],
      select: false,
    },
    region: {
      type: String,
      default: "global",
      trim: true,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: String,
      required: [true, "createdBy is required"],
      index: true,
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
        delete ret.credentialsEncrypted;
        return ret;
      },
    },
  }
);

CloudIntegrationSchema.index({ workspaceId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model("CloudIntegration", CloudIntegrationSchema);
