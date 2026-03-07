/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../../models/Repository");
const ParsedPipeline = require("../../models/ParsedPipeline");
const SimulationResult = require("../../models/SimulationResult");
const { parseRepositoryPipelines } = require("../pipelineParser/pipelineParserService");
const {
  cloneRepositoryToTempWorkspace,
  cleanupTempWorkspace,
} = require("../repositoryAnalyzer/repositoryCloneService");
const { runStageInSandbox, ensureDockerAvailable } = require("./dockerSandboxRunnerService");

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

async function resolvePipelineForRepository(repository, pipelineId) {
  let pipelines = await ParsedPipeline.find({ repositoryId: repository._id });

  if (!pipelines.length) {
    pipelines = await parseRepositoryPipelines(repository._id);
  }

  if (!pipelines.length) {
    const err = new Error("No pipeline configuration found. Parse pipeline first.");
    err.status = 404;
    throw err;
  }

  if (pipelineId) {
    const selected = pipelines.find((pipeline) => String(pipeline._id) === String(pipelineId));
    if (!selected) {
      const err = new Error("Pipeline not found for this repository");
      err.status = 404;
      throw err;
    }
    return selected;
  }

  return pipelines[0];
}

async function runSandboxSimulation({ repositoryId, pipelineId }) {
  const repository = await Repository.findById(repositoryId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  await ensureDockerAvailable();

  const pipeline = await resolvePipelineForRepository(repository, pipelineId);
  const stages = [...pipeline.stages].sort((a, b) => a.order - b.order);

  if (!stages.length) {
    const err = new Error("Pipeline has no stages to simulate");
    err.status = 400;
    throw err;
  }

  let tempRoot = null;

  try {
    const { tempRoot: tmp, cloneDir } = await cloneRepositoryToTempWorkspace(repository._id);
    tempRoot = tmp;

    const stageResults = [];

    for (const stage of stages) {
      const stageResult = await runStageInSandbox({
        cloneDir,
        stageName: stage.name,
      });

      stageResults.push(stageResult);
    }

    const cpuUsage = average(stageResults.map((item) => item.cpuUsage));
    const memoryUsage = average(stageResults.map((item) => item.memoryUsage));
    const latency = average(stageResults.map((item) => item.latency));
    const failedCount = stageResults.filter((item) => item.status === "failed").length;
    const errorRate = (failedCount / stageResults.length) * 100;

    const status =
      failedCount === 0
        ? "success"
        : failedCount === stageResults.length
          ? "failed"
          : "partial";

    const resultDoc = await SimulationResult.create({
      repositoryId: repository._id,
      pipelineId: pipeline._id,
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      latency: Math.round(latency * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      status,
      logs: stageResults.map((item) => `[${item.stageName}] ${item.log}`),
      timestamp: new Date(),
    });

    return {
      simulationResult: resultDoc,
      stageResults,
    };
  } finally {
    await cleanupTempWorkspace(tempRoot);
  }
}

async function getSimulationResultsByRepository(repositoryId) {
  const repository = await Repository.findById(repositoryId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  const results = await SimulationResult.find({ repositoryId })
    .sort({ timestamp: -1 })
    .limit(50);

  return results;
}

module.exports = {
  runSandboxSimulation,
  getSimulationResultsByRepository,
};
