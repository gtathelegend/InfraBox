const express = require("express");
const {
  runFullAnalysis,
  getAnalysisHistory,
} = require("../controllers/predictiveIntelligenceController");
const { checkJwt } = require("../middleware/auth");

const router = express.Router();

router.use(checkJwt);
router.post("/full-analysis", runFullAnalysis);
router.get("/:repositoryId/history", getAnalysisHistory);

module.exports = router;
