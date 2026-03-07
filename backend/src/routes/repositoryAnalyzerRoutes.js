const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  runAnalysis,
  getAnalysis,
  getDependencyGraph,
  scanTechnicalDebt,
} = require("../controllers/repositoryAnalyzerController");

router.use(checkJwt);

router.post("/run", runAnalysis);
router.post("/debt", scanTechnicalDebt);
router.get("/:repoId/dependency-graph", getDependencyGraph);
router.get("/:repoId", getAnalysis);

module.exports = router;
