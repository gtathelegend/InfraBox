const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  runSimulation,
  getSimulationResults,
  analyzeSimulation,
} = require("../controllers/sandboxSimulationController");

router.use(checkJwt);

router.post("/run", runSimulation);
router.post("/analyze", analyzeSimulation);
router.get("/:repoId", getSimulationResults);

module.exports = router;
