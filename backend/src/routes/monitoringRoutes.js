const express = require("express");
const { checkJwt } = require("../middleware/auth");
const { getMonitoringMetrics } = require("../controllers/monitoringController");

const router = express.Router();

router.use(checkJwt);
router.get("/metrics", getMonitoringMetrics);

module.exports = router;
