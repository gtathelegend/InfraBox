/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const PredictiveIntelligenceReportSchema = new mongoose.Schema(
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
    trafficScenario: {
      type: String,
      enum: ["baseline", "peak", "spike", "custom"],
      default: "baseline",
    },
    orchestrationStatus: {
      type: String,
      enum: ["in_progress", "completed", "failed"],
      default: "in_progress",
    },
    digitalTwinPrediction: {
      simulationId: mongoose.Schema.Types.ObjectId,
      successProbability: Number,
      averageLatency: Number,
      peakMemory: Number,
      cpuUtilization: Number,
      estimatedResourceCost: Number,
      riskFactors: [String],
      timestamp: Date,
    },
    failurePrediction: {
      predictionId: mongoose.Schema.Types.ObjectId,
      failureProbability: Number,
      riskFactors: [
        {
          service: String,
          riskScore: Number,
          reason: String,
        },
      ],
      timestamp: Date,
    },
    costPrediction: {
      predictionId: mongoose.Schema.Types.ObjectId,
      monthlyCostEstimate: Number,
      spikeCostEstimate: Number,
      costBreakdown: {
        compute: Number,
        storage: Number,
        network: Number,
      },
      timestamp: Date,
    },
    deploymentConfidence: {
      scoreId: mongoose.Schema.Types.ObjectId,
      confidenceScore: Number,
      riskLevel: String,
      recommendations: [
        {
          priority: String,
          message: String,
        },
      ],
      timestamp: Date,
    },
    finalRiskReport: {
      overallRiskScore: Number,
      riskLevel: String,
      detectedRisks: [
        {
          service: String,
          riskType: String,
          severity: String,
          description: String,
        },
      ],
      recommendedActions: [
        {
          priority: String,
          action: String,
          impact: String,
        },
      ],
      deploymentReadiness: {
        isReady: Boolean,
        readinessPercentage: Number,
        blockers: [String],
        warnings: [String],
      },
    },
    executionTimeline: {
      orchestrationStarted: Date,
      digitalTwinCompleted: Date,
      failurePredictionCompleted: Date,
      costPredictionCompleted: Date,
      deploymentConfidenceCompleted: Date,
      orchestrationCompleted: Date,
      totalDurationMs: Number,
    },
    errorLog: [
      {
        stage: String,
        error: String,
        timestamp: Date,
      },
    ],
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc) {
        return {
          reportId: doc._id,
          repositoryId: doc.repositoryId,
          workspaceId: doc.workspaceId,
          trafficScenario: doc.trafficScenario,
          orchestrationStatus: doc.orchestrationStatus,
          digitalTwinPrediction: doc.digitalTwinPrediction,
          failurePrediction: doc.failurePrediction,
          costPrediction: doc.costPrediction,
          deploymentConfidence: doc.deploymentConfidence,
          finalRiskReport: doc.finalRiskReport,
          executionTimeline: doc.executionTimeline,
          errorLog: doc.errorLog,
          generatedAt: doc.generatedAt,
        };
      },
    },
  }
);

PredictiveIntelligenceReportSchema.index({ repositoryId: 1 });
PredictiveIntelligenceReportSchema.index({ workspaceId: 1 });
PredictiveIntelligenceReportSchema.index({ generatedAt: -1 });
PredictiveIntelligenceReportSchema.index({ orchestrationStatus: 1 });

module.exports = mongoose.model("PredictiveIntelligenceReport", PredictiveIntelligenceReportSchema);
