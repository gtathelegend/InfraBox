/* eslint-disable @typescript-eslint/no-require-imports */
const { analyzeCommitHistory } = require("./geminiAnalysisService");

async function runCommitAnalysis(metadata) {
  return analyzeCommitHistory(metadata.commitHistory);
}

module.exports = {
  runCommitAnalysis,
};
