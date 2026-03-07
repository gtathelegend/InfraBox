const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  runAnalysis,
  getDependencyGraph,
  scanTechnicalDebt,
} = require("../controllers/repositoryAnalyzerController");
const {
  getAnalysisByRepositoryId,
} = require("../controllers/repositoryAnalysisController");

router.use(checkJwt);

router.post("/run", runAnalysis);
router.post("/debt", scanTechnicalDebt);
router.get("/:repoId/dependency-graph", getDependencyGraph);
router.get("/:repoId", getAnalysisByRepositoryId);

module.exports = router;
