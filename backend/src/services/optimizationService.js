/* eslint-disable @typescript-eslint/no-require-imports */
const {
  analyzeCodeOptimization,
  generateDevopsRecommendations,
} = require("./geminiAnalysisService");

async function runOptimizationAnalysis(metadata) {
  return analyzeCodeOptimization(metadata);
}

async function runDevopsRecommendations(context) {
  return generateDevopsRecommendations(context);
}

module.exports = {
  runOptimizationAnalysis,
  runDevopsRecommendations,
};
