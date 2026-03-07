const express = require("express");
const { checkJwt } = require("../middleware/auth");
const { triggerHealing } = require("../controllers/healingController");

const router = express.Router();

router.use(checkJwt);
router.post("/trigger", triggerHealing);

module.exports = router;
