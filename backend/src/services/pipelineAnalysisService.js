/* eslint-disable @typescript-eslint/no-require-imports */
const { analyzeCicdPipeline } = require("./geminiAnalysisService");

async function runPipelineAnalysis(metadata) {
  return analyzeCicdPipeline(metadata.pipelineFiles);
}

module.exports = {
  runPipelineAnalysis,
};
