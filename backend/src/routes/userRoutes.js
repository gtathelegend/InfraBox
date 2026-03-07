const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const { getMe } = require("../controllers/userController");

// ─── GET /api/me ────────────────────────────────────────────────────
// Returns the authenticated user's profile, workspaces, and roles.
// Handles first-login onboarding automatically.
router.get("/", checkJwt, getMe);

module.exports = router;
