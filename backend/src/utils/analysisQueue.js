/* eslint-disable @typescript-eslint/no-require-imports */
const { Queue, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");

const ANALYSIS_QUEUE_NAME = "repository-analysis";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const analysisQueue = new Queue(ANALYSIS_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
  },
});

const analysisQueueEvents = new QueueEvents(ANALYSIS_QUEUE_NAME, {
  connection: redisConnection,
});

async function enqueueRepositoryAnalysis(payload) {
  const job = await analysisQueue.add("analyze-repository", payload, {
    jobId: `${payload.repositoryId}:${Date.now()}`,
  });

  return job;
}

module.exports = {
  ANALYSIS_QUEUE_NAME,
  redisConnection,
  analysisQueue,
  analysisQueueEvents,
  enqueueRepositoryAnalysis,
};
