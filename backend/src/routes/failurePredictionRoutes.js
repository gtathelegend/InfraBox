const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const { predictFailure } = require("../controllers/failurePredictionController");
const { predictCost, listPredictions } = require("../controllers/costPredictionController");

router.use(checkJwt);

// Failure prediction endpoints
router.post("/failure", predictFailure);

// Cost prediction endpoints
router.post("/cost", predictCost);
router.get("/cost/workspace/:workspaceId", listPredictions);

module.exports = router;
