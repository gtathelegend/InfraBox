const express = require("express");
const router = express.Router();

const { checkJwt } = require("../middleware/auth");
const { checkPermission } = require("../middleware/rbac");
const {
  validateCreateWorkspace,
  validateInviteMember,
  validateWorkspaceId,
} = require("../validators/workspace");
const {
  createWorkspace,
  getUserWorkspaces,
  inviteMember,
  listMembers,
  loadWorkspace,
} = require("../controllers/workspaceController");

// ─── All workspace routes require a valid JWT ───────────────────────
router.use(checkJwt);

// ─── POST /api/workspaces ───────────────────────────────────────────
// Create a new workspace. The authenticated user becomes the owner.
router.post("/", validateCreateWorkspace, createWorkspace);

// ─── GET  /api/workspaces ───────────────────────────────────────────
// Retrieve all workspaces where the user is owner or member.
router.get("/", getUserWorkspaces);

// ─── POST /api/workspaces/:workspaceId/invite ───────────────────────
// Invite a new member. Only Owner or DevOps Engineer may invite.
router.post(
  "/:workspaceId/invite",
  validateWorkspaceId,
  validateInviteMember,
  loadWorkspace,
  checkPermission("invite_members"),
  inviteMember
);

// ─── GET  /api/workspaces/:workspaceId/members ──────────────────────
// List all members of a workspace (any member can view).
router.get(
  "/:workspaceId/members",
  validateWorkspaceId,
  loadWorkspace,
  checkPermission("view_dashboard"),
  listMembers
);

module.exports = router;
