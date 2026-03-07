const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const {
  connectRepository,
  importProviderRepositories,
  getRepositoryBranches,
  getRepositoryCommits,
  getRepositoryPullRequests,
} = require("../controllers/repoConnectorController");

router.use(checkJwt);

router.post("/connect", connectRepository);
router.get("/import", importProviderRepositories);
router.get("/:repoId/branches", getRepositoryBranches);
router.get("/:repoId/commits", getRepositoryCommits);
router.get("/:repoId/pull-requests", getRepositoryPullRequests);

module.exports = router;
