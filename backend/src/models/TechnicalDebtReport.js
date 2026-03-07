/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const TechnicalDebtReportSchema = new mongoose.Schema(
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
    debtScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    riskFactors: {
      type: [String],
      default: [],
    },
    recommendations: {
      type: [String],
      default: [],
    },
    details: {
      outdatedDependencies: { type: Number, default: 0 },
      highComplexityFiles: { type: Number, default: 0 },
      churnHotspots: { type: Number, default: 0 },
      estimatedCoverage: { type: Number, default: 0 },
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    scannedBy: {
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

module.exports = mongoose.model("TechnicalDebtReport", TechnicalDebtReportSchema);
