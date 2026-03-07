const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const { simulateDigitalTwin } = require("../controllers/digitalTwinController");

router.use(checkJwt);

router.post("/simulate", simulateDigitalTwin);

module.exports = router;
