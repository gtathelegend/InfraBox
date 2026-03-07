const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const { predictFailure } = require("../controllers/failurePredictionController");

router.use(checkJwt);

router.post("/failure", predictFailure);

module.exports = router;
