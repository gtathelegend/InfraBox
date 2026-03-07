const express = require("express");
const {
  scoreDeployment,
  getConfidenceHistory,
  approveForDeployment,
} = require("../controllers/deploymentConfidenceController");
const { checkJwt } = require("../middleware/auth");

const router = express.Router();

router.use(checkJwt);
router.post("/score", scoreDeployment);
router.get("/:repositoryId", getConfidenceHistory);
router.post("/:scoreId/approve", approveForDeployment);

module.exports = router;
