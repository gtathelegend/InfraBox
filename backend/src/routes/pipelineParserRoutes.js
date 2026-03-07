const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  parsePipeline,
  getPipeline,
} = require("../controllers/pipelineParserController");

router.use(checkJwt);

router.post("/parse", parsePipeline);
router.get("/:repoId", getPipeline);

module.exports = router;
