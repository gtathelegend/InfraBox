/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const GitConnectionSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["github", "gitlab", "bitbucket"],
      required: [true, "provider is required"],
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "workspaceId is required"],
      index: true,
    },
    ownerId: {
      type: String,
      required: [true, "ownerId is required"],
      index: true,
    },
    accessToken: {
      type: String,
      required: [true, "accessToken is required"],
    },
    refreshToken: {
      type: String,
      default: "",
    },
    tokenType: {
      type: String,
      default: "Bearer",
    },
    providerUserId: {
      type: String,
      default: "",
    },
    providerUsername: {
      type: String,
      default: "",
    },
    connectedAt: {
      type: Date,
      default: Date.now,
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
        delete ret.accessToken;
        delete ret.refreshToken;
        return ret;
      },
    },
  }
);

GitConnectionSchema.index({ provider: 1, workspaceId: 1, ownerId: 1 }, { unique: true });

module.exports = mongoose.model("GitConnection", GitConnectionSchema);
