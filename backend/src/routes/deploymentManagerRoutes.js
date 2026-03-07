const express = require("express");
const { checkJwt } = require("../middleware/auth");
const { runDeploymentController } = require("../controllers/deploymentManagerController");

const router = express.Router();

router.use(checkJwt);
router.post("/run", runDeploymentController);

module.exports = router;
