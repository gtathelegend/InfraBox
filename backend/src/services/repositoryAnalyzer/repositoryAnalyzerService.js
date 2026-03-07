/* eslint-disable @typescript-eslint/no-require-imports */
const Dependency = require("../../models/Dependency");
const RepositoryAnalysis = require("../../models/RepositoryAnalysis");
const {
  cloneRepositoryToTempWorkspace,
  cleanupTempWorkspace,
} = require("./repositoryCloneService");
const { scanRepositoryFiles } = require("./fileScannerService");
const { detectFrameworks } = require("./frameworkDetectorService");
const { extractDependencies } = require("./dependencyExtractorService");
const { detectServices, buildSummary } = require("./serviceDetectorService");

async function runRepositoryAnalysis({ repositoryId, userId }) {
  let tempRoot = null;

  try {
    const { repository, tempRoot: tmp, cloneDir } = await cloneRepositoryToTempWorkspace(repositoryId);
    tempRoot = tmp;

    const scanData = await scanRepositoryFiles(cloneDir);
    const frameworkResult = detectFrameworks(scanData);
    const dependencies = extractDependencies(scanData, frameworkResult.packageJson);
    const services = detectServices({
      frameworks: frameworkResult.frameworks,
      dependencies,
      scanData,
    });

    const summary = buildSummary({
      frameworks: frameworkResult.frameworks,
      services,
      dependencies,
    });

    await Dependency.deleteMany({ repositoryId: repository._id });
    if (dependencies.length) {
      await Dependency.insertMany(
        dependencies.map((dep) => ({
          repositoryId: repository._id,
          name: dep.name,
          version: dep.version || "unknown",
          type: dep.type || "runtime",
        }))
      );
    }

    const analysis = await RepositoryAnalysis.findOneAndUpdate(
      { repositoryId: repository._id },
      {
        repositoryId: repository._id,
        workspaceId: repository.workspaceId,
        frameworks: frameworkResult.frameworks,
        languages: frameworkResult.languages,
        services,
        configurations: frameworkResult.configurations,
        summary,
        analyzedAt: new Date(),
        analyzedBy: userId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return analysis;
  } finally {
    await cleanupTempWorkspace(tempRoot);
  }
}

async function getRepositoryAnalysis(repositoryId) {
  const analysis = await RepositoryAnalysis.findOne({ repositoryId });
  if (!analysis) {
    const err = new Error("Analysis not found for this repository");
    err.status = 404;
    throw err;
  }

  const dependencies = await Dependency.find({ repositoryId }).sort({ name: 1 });

  return {
    analysis,
    dependencies,
  };
}

module.exports = {
  runRepositoryAnalysis,
  getRepositoryAnalysis,
};
