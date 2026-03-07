const express = require("express");
const { queryAssistant, getHistory } = require("../controllers/devopsAssistantController");
const { checkJwt } = require("../middleware/auth");

const router = express.Router();

router.use(checkJwt);
router.post("/query", queryAssistant);
router.get("/:workspaceId/history", getHistory);

module.exports = router;
