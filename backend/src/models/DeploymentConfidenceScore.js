/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const DeploymentConfidenceScoreSchema = new mongoose.Schema(
  {
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    riskLevel: {
      type: String,
      enum: ["SAFE_TO_DEPLOY", "LOW_RISK", "MEDIUM_RISK", "HIGH_RISK", "CRITICAL_RISK"],
      required: true,
    },
    inputSignals: {
      testCoverage: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },
      pipelineSuccessRate: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },
      securityScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },
      failurePredictionScore: {
        type: Number,
        min: 0,
        max: 1,
        required: true,
      },
      costRiskScore: {
        type: Number,
        min: 0,
        max: 1,
        required: true,
      },
    },
    weightedContributions: {
      testCoverageContribution: Number,
      pipelineSuccessContribution: Number,
      securityContribution: Number,
      failurePredictionContribution: Number,
      costRiskContribution: Number,
    },
    recommendations: [
      {
        priority: {
          type: String,
          enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        },
        message: String,
      },
    ],
    releaseReadiness: {
      testCoverageReady: Boolean,
      pipelineHealthy: Boolean,
      secureForRelease: Boolean,
      lowFailureRisk: Boolean,
      acceptableCost: Boolean,
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
    deploymentApprovedAt: Date,
    approvedBy: mongoose.Schema.Types.ObjectId,
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc) {
        return {
          scoreId: doc._id,
          repositoryId: doc.repositoryId,
          workspaceId: doc.workspaceId,
          confidenceScore: doc.confidenceScore,
          riskLevel: doc.riskLevel,
          inputSignals: doc.inputSignals,
          weightedContributions: doc.weightedContributions,
          recommendations: doc.recommendations,
          releaseReadiness: doc.releaseReadiness,
          evaluatedAt: doc.evaluatedAt,
          deploymentApprovedAt: doc.deploymentApprovedAt,
          approvedBy: doc.approvedBy,
        };
      },
    },
  }
);

DeploymentConfidenceScoreSchema.index({ repositoryId: 1 });
DeploymentConfidenceScoreSchema.index({ workspaceId: 1 });
DeploymentConfidenceScoreSchema.index({ evaluatedAt: -1 });
DeploymentConfidenceScoreSchema.index({ riskLevel: 1 });

module.exports = mongoose.model("DeploymentConfidenceScore", DeploymentConfidenceScoreSchema);
