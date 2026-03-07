const express = require("express");
const { checkJwt } = require("../middleware/auth");
const { getOverview } = require("../controllers/dashboardController");

const router = express.Router();

router.use(checkJwt);
router.get("/overview", getOverview);

module.exports = router;
