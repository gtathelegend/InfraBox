const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  connectCloud,
  getInfrastructureMetrics,
  getBillingData,
} = require("../controllers/cloudIntegrationController");

router.use(checkJwt);

router.post("/connect", connectCloud);
router.get("/metrics", getInfrastructureMetrics);
router.get("/billing", getBillingData);

module.exports = router;
