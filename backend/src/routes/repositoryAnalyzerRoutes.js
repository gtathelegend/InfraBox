const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  runAnalysis,
  getAnalysis,
} = require("../controllers/repositoryAnalyzerController");

router.use(checkJwt);

router.post("/run", runAnalysis);
router.get("/:repoId", getAnalysis);

module.exports = router;
