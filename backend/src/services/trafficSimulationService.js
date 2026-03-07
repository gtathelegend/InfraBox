/* eslint-disable @typescript-eslint/no-require-imports */
const { simulateTraffic } = require("./geminiAnalysisService");

async function runTrafficSimulation({ architectureAnalysis, infrastructure }) {
  return simulateTraffic(architectureAnalysis, infrastructure);
}

module.exports = {
  runTrafficSimulation,
};
