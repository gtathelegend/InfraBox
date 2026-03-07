const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  planRemediationsFromFailurePrediction,
  planRemediationsFromDigitalTwin,
  approvePlan,
  executePlan,
  getPlanDetails,
  listPlansForRepository,
} = require("../controllers/autonomousAgentController");

router.use(checkJwt);

router.post("/failure-prediction", planRemediationsFromFailurePrediction);
router.post("/digital-twin", planRemediationsFromDigitalTwin);
router.post("/approve", approvePlan);
router.post("/execute", executePlan);
router.get("/:planId", getPlanDetails);
router.get("/repository/:repositoryId", listPlansForRepository);

module.exports = router;
