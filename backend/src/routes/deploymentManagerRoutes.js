const express = require("express");
const { checkJwt } = require("../middleware/auth");
const {
	runDeploymentController,
	getDeploymentHistoryController,
	getDeploymentLogsController,
	streamDeploymentEventsController,
} = require("../controllers/deploymentManagerController");

const router = express.Router();

router.use(checkJwt);
router.post("/run", runDeploymentController);
router.get("/history", getDeploymentHistoryController);
router.get("/:deploymentId/logs", getDeploymentLogsController);
router.get("/events/stream", streamDeploymentEventsController);

module.exports = router;
