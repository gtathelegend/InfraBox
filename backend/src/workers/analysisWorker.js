/* eslint-disable @typescript-eslint/no-require-imports */
const { Worker } = require("bullmq");

const AnalysisResult = require("../models/AnalysisResult");
const {
  cloneRepository,
  cleanupRepositoryClone,
  extractRepositoryMetadata,
} = require("../services/repositoryService");
const { runAnalysisOrchestrator } = require("../services/analysisOrchestrator");
const { ANALYSIS_QUEUE_NAME, redisConnection } = require("../utils/analysisQueue");

let workerInstance = null;

async function processAnalysisJob(job) {
  const { analysisId, infrastructure, repoUrl, branch } = job.data;

  const analysisResult = await AnalysisResult.findById(analysisId);
  if (!analysisResult) {
    throw new Error(`AnalysisResult ${analysisId} not found`);
  }

  analysisResult.status = "running";
  analysisResult.startedAt = new Date();
  await analysisResult.save();

  let tempRoot = null;

  try {
    const clone = await cloneRepository(repoUrl, branch);
    tempRoot = clone.tempRoot;

    const metadata = await extractRepositoryMetadata(clone.clonePath);
    const output = await runAnalysisOrchestrator({
      metadata,
      infrastructure,
    });

    analysisResult.status = "completed";
    analysisResult.metadataSnapshot = metadata;
    analysisResult.result = output;
    analysisResult.completedAt = new Date();
    analysisResult.error = {
      message: "",
      stack: "",
      failedAt: null,
    };
    await analysisResult.save();

    return {
      analysisId,
      repositoryId: String(analysisResult.repositoryId),
      status: "completed",
    };
  } catch (error) {
    analysisResult.status = "failed";
    analysisResult.error = {
      message: error.message,
      stack: error.stack || "",
      failedAt: new Date(),
    };
    await analysisResult.save();

    throw error;
  } finally {
    await cleanupRepositoryClone(tempRoot);
  }
}

function startAnalysisWorker() {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(ANALYSIS_QUEUE_NAME, processAnalysisJob, {
    connection: redisConnection,
    concurrency: Number(process.env.ANALYSIS_WORKER_CONCURRENCY || 2),
  });

  workerInstance.on("completed", (job) => {
    console.log(`[analysis-worker] job ${job.id} completed`);
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`[analysis-worker] job ${job?.id || "unknown"} failed`, err);
  });

  workerInstance.on("error", (err) => {
    console.error("[analysis-worker] worker error", err);
  });

  return workerInstance;
}

module.exports = {
  startAnalysisWorker,
};
