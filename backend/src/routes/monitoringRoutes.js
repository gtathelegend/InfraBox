const express = require("express");
const { checkJwt } = require("../middleware/auth");
const {
	getMonitoringMetrics,
	analyzeMonitoringAnomalies,
} = require("../controllers/monitoringController");

const router = express.Router();

router.use(checkJwt);
router.get("/metrics", getMonitoringMetrics);
router.post("/analyze", analyzeMonitoringAnomalies);

module.exports = router;
