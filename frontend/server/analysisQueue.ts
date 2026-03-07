import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { eq } from "drizzle-orm";

import { db } from "./db";
import {
  analysisJobs,
  codeAnalysisResults,
  infrastructureCompatibilityResults,
  infrastructureConfigs,
  preventiveSuggestions,
  repositories,
  trafficSimulationResults,
} from "@shared/schema";
import {
  analyzeCodebase,
  evaluateCompatibility,
  generatePreventiveSuggestions,
  simulateTraffic,
} from "./analysisEngine";

type AnalysisJobPayload = {
  jobId: number;
  workspaceId: number;
  repoId: number;
};

const redisUrl = process.env.REDIS_URL;
const connection: ConnectionOptions | null = redisUrl
  ? {
      url: redisUrl,
      maxRetriesPerRequest: null,
    }
  : null;

let queue: Queue | null = null;
let worker: Worker | null = null;

async function executeAnalysis(payload: AnalysisJobPayload) {
  const [repo] = await db.select().from(repositories).where(eq(repositories.id, payload.repoId)).limit(1);
  if (!repo) {
    await db
      .update(analysisJobs)
      .set({ status: "failed", error: "Repository not found", updatedAt: new Date().toISOString() })
      .where(eq(analysisJobs.id, payload.jobId));
    return;
  }

  const [config] = await db
    .select()
    .from(infrastructureConfigs)
    .where(eq(infrastructureConfigs.repoId, payload.repoId))
    .orderBy(infrastructureConfigs.id)
    .limit(1);

  if (!config) {
    await db
      .update(analysisJobs)
      .set({ status: "failed", error: "Infrastructure config missing", updatedAt: new Date().toISOString() })
      .where(eq(analysisJobs.id, payload.jobId));
    return;
  }

  await db
    .update(analysisJobs)
    .set({ status: "running", updatedAt: new Date().toISOString() })
    .where(eq(analysisJobs.id, payload.jobId));

  const analysis = await analyzeCodebase(
    {
      name: repo.name,
      provider: repo.provider,
      url: repo.url,
      defaultBranch: repo.defaultBranch,
    },
    {
      provider: config.provider,
      cpu: config.cpu,
      memoryGb: config.memoryGb,
      storageGb: config.storageGb,
      autoscaling: Boolean(config.autoscaling),
      region: config.region,
    },
  );

  const [analysisRow] = await db
    .insert(codeAnalysisResults)
    .values({
      workspaceId: payload.workspaceId,
      repoId: payload.repoId,
      infrastructureConfigId: config.id,
      framework: analysis.framework,
      backend: analysis.backend,
      language: analysis.language,
      servicesJson: JSON.stringify(analysis.services),
      dependenciesJson: JSON.stringify(analysis.dependencies),
      database: analysis.database,
      cache: analysis.cache,
      estimatedMemoryGb: analysis.estimatedMemoryGb,
      estimatedCpuCores: analysis.estimatedCpuCores,
      pipelineStagesJson: JSON.stringify(analysis.pipeline),
      pipelineGraphJson: JSON.stringify(analysis.pipelineGraph),
      serviceDependencyGraphJson: JSON.stringify(analysis.serviceDependencyGraph),
      rawJson: JSON.stringify(analysis),
    })
    .returning();

  const scenarios = await simulateTraffic(analysis);

  await db.insert(trafficSimulationResults).values({
    workspaceId: payload.workspaceId,
    repoId: payload.repoId,
    analysisId: analysisRow.id,
    scenariosJson: JSON.stringify(scenarios),
  });

  const compatibility = evaluateCompatibility(
    {
      provider: config.provider,
      cpu: config.cpu,
      memoryGb: config.memoryGb,
      storageGb: config.storageGb,
      autoscaling: Boolean(config.autoscaling),
      region: config.region,
    },
    analysis,
    scenarios,
  );

  await db.insert(infrastructureCompatibilityResults).values({
    workspaceId: payload.workspaceId,
    repoId: payload.repoId,
    analysisId: analysisRow.id,
    infrastructureConfigId: config.id,
    serverMemoryGb: compatibility.serverMemoryGb,
    predictedMemoryGb: compatibility.predictedMemoryGb,
    serverCpuCores: compatibility.serverCpuCores,
    predictedCpuCores: compatibility.predictedCpuCores,
    result: compatibility.result,
    risksJson: JSON.stringify(compatibility.risks),
  });

  const suggestions = await generatePreventiveSuggestions(compatibility.risks);
  if (suggestions.length) {
    await db.insert(preventiveSuggestions).values(
      suggestions.map((item) => ({
        workspaceId: payload.workspaceId,
        repoId: payload.repoId,
        analysisId: analysisRow.id,
        issue: item.issue,
        solution: item.solution,
        codeLocation: item.codeLocation,
      })),
    );
  }

  await db
    .update(analysisJobs)
    .set({
      status: "completed",
      analysisId: analysisRow.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(analysisJobs.id, payload.jobId));

  await db
    .update(repositories)
    .set({ lastAnalyzed: new Date().toISOString() })
    .where(eq(repositories.id, payload.repoId));
}

export async function initAnalysisQueue() {
  if (!connection) return;

  queue = new Queue("analysis-jobs", { connection });
  worker = new Worker(
    "analysis-jobs",
    async (job) => {
      await executeAnalysis(job.data as AnalysisJobPayload);
    },
    { connection },
  );

  worker.on("failed", async (job, error) => {
    const jobId = Number(job?.data?.jobId);
    if (!jobId) return;

    await db
      .update(analysisJobs)
      .set({ status: "failed", error: error.message, updatedAt: new Date().toISOString() })
      .where(eq(analysisJobs.id, jobId));
  });
}

export async function enqueueAnalysis(payload: AnalysisJobPayload) {
  if (queue) {
    await queue.add("analyze", payload, { removeOnComplete: 25, removeOnFail: 50 });
    return;
  }

  // Fallback mode when Redis is unavailable.
  setTimeout(() => {
    executeAnalysis(payload).catch(async (error) => {
      await db
        .update(analysisJobs)
        .set({ status: "failed", error: error instanceof Error ? error.message : "Unknown error", updatedAt: new Date().toISOString() })
        .where(eq(analysisJobs.id, payload.jobId));
    });
  }, 0);
}
