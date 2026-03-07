/* eslint-disable @typescript-eslint/no-require-imports */
const { analyzeArchitecture, generateDependencyGraph } = require("./geminiAnalysisService");
const { runCommitAnalysis } = require("./commitAnalysisService");
const { runPipelineAnalysis } = require("./pipelineAnalysisService");
const { runTrafficSimulation } = require("./trafficSimulationService");
const { compareWithInfrastructure } = require("./infrastructureComparisonService");
const {
  runOptimizationAnalysis,
  runDevopsRecommendations,
} = require("./optimizationService");

async function runAnalysisOrchestrator({ metadata, infrastructure }) {
  const architectureAnalysis = await analyzeArchitecture(metadata);
  const dependencyGraph = await generateDependencyGraph(metadata);
  const commitInsights = await runCommitAnalysis(metadata);
  const pipelineGraph = await runPipelineAnalysis(metadata);
  const trafficSimulation = await runTrafficSimulation({
    architectureAnalysis,
    infrastructure,
  });
  const infraCompatibility = compareWithInfrastructure(trafficSimulation, infrastructure);
  const codeOptimization = await runOptimizationAnalysis(metadata);
  const devopsRecommendations = await runDevopsRecommendations({
    architectureAnalysis,
    dependencyGraph,
    commitInsights,
    pipelineGraph,
    trafficSimulation,
    infraCompatibility,
    codeOptimization,
  });

  return {
    architectureAnalysis,
    dependencyGraph,
    commitInsights,
    pipelineGraph,
    trafficSimulation,
    infraCompatibility,
    codeOptimization,
    devopsRecommendations,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  runAnalysisOrchestrator,
};
