const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  enqueueRepositoryAnalysisRequest,
} = require("../controllers/repositoryAnalysisController");

router.use(checkJwt);

router.post("/analyze", enqueueRepositoryAnalysisRequest);

module.exports = router;