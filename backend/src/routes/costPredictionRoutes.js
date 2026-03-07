const express = require("express");
const { predictCost, listPredictions } = require("../controllers/costPredictionController");
const { checkJwt } = require("../middleware/auth");

const router = express.Router();

router.use(checkJwt);
router.post("/cost", predictCost);
router.get("/workspace/:workspaceId", listPredictions);

module.exports = router;
