/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../models/Repository");
const { hasPermission } = require("../middleware/rbac");
const { requireWorkspaceMember } = require("../services/repoConnector/workspaceAccessService");
const {
  runRepositoryAnalysis,
  getRepositoryAnalysis,
} = require("../services/repositoryAnalyzer/repositoryAnalyzerService");
const {
  generateDependencyGraph,
} = require("../services/repositoryAnalyzer/dependencyGraphBuilderService");
const {
  runTechnicalDebtScan,
} = require("../services/repositoryAnalyzer/technicalDebtDetectorService");

function enforceAction(role, action) {
  if (!hasPermission(role, action)) {
    const err = new Error("You do not have permission to perform this action");
    err.status = 403;
    throw err;
  }
}

function handleError(res, err, fallbackMessage) {
  console.error(fallbackMessage, err);
  return res.status(err.status || 500).json({
    error: err.status && err.status < 500 ? "request_error" : "server_error",
    message: err.message || fallbackMessage,
  });
}

async function ensureRepositoryAccess(repoId, userId) {
  const repository = await Repository.findById(repoId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  const { role } = await requireWorkspaceMember(String(repository.workspaceId), userId);
  enforceAction(role, "view_dashboard");

  return repository;
}

async function runAnalysis(req, res) {
  try {
    const { repositoryId } = req.body;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    const userId = req.auth.sub;
    const repository = await ensureRepositoryAccess(repositoryId, userId);

    const analysis = await runRepositoryAnalysis({
      repositoryId: repository._id,
      userId,
    });

    return res.status(200).json({
      message: "Repository analysis completed successfully",
      repositoryId: String(repository._id),
      result: analysis,
      output: {
        Frontend: analysis.summary?.frontend || "unknown",
        Backend: analysis.summary?.backend || "unknown",
        Database: analysis.summary?.database || "unknown",
        Cache: analysis.summary?.cache || "unknown",
      },
    });
  } catch (err) {
    return handleError(res, err, "Failed to run repository analysis");
  }
}

async function getAnalysis(req, res) {
  try {
    const { repoId } = req.params;
    const userId = req.auth.sub;

    await ensureRepositoryAccess(repoId, userId);

    const result = await getRepositoryAnalysis(repoId);

    return res.status(200).json({
      message: "Repository analysis retrieved successfully",
      repositoryId: repoId,
      analysis: result.analysis,
      dependencies: result.dependencies,
      output: {
        Frontend: result.analysis.summary?.frontend || "unknown",
        Backend: result.analysis.summary?.backend || "unknown",
        Database: result.analysis.summary?.database || "unknown",
        Cache: result.analysis.summary?.cache || "unknown",
      },
    });
  } catch (err) {
    return handleError(res, err, "Failed to retrieve repository analysis");
  }
}

async function getDependencyGraph(req, res) {
  try {
    const { repoId } = req.params;
    const userId = req.auth.sub;

    await ensureRepositoryAccess(repoId, userId);

    const graph = await generateDependencyGraph({
      repositoryId: repoId,
      userId,
    });

    return res.status(200).json({
      message: "Dependency graph generated successfully",
      repositoryId: repoId,
      nodes: graph.nodes,
      edges: graph.edges,
    });
  } catch (err) {
    return handleError(res, err, "Failed to generate dependency graph");
  }
}

async function scanTechnicalDebt(req, res) {
  try {
    const { repositoryId } = req.body;

    if (!repositoryId) {
      return res.status(400).json({
        error: "validation_error",
        message: "repositoryId is required",
      });
    }

    const userId = req.auth.sub;
    await ensureRepositoryAccess(repositoryId, userId);

    const result = await runTechnicalDebtScan({
      repositoryId,
      userId,
    });

    return res.status(200).json({
      message: "Technical debt scan completed successfully",
      repositoryId,
      debtScore: result.debtScore,
      riskFactors: result.riskFactors,
      recommendations: result.recommendations,
      details: result.details,
    });
  } catch (err) {
    return handleError(res, err, "Failed to run technical debt scan");
  }
}

module.exports = {
  runAnalysis,
  getAnalysis,
  getDependencyGraph,
  scanTechnicalDebt,
};
