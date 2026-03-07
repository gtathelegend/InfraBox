const Workspace = require("../models/Workspace");
const { resolveRole } = require("./rbac");

// ─── verifyWorkspaceAccess ──────────────────────────────────────────
// Reusable tenant-isolation middleware for any route scoped under
// /api/workspaces/:workspaceId/*
//
// Responsibilities:
//   1. Validate that :workspaceId is a valid ObjectId
//   2. Load the workspace from MongoDB
//   3. Verify the authenticated user is a member (owner or member)
//   4. Resolve & attach the user's role
//   5. Block all unauthorized access
//
// After this middleware runs, downstream handlers can safely use:
//   req.workspace   — the Mongoose workspace document
//   req.userRole    — the user's resolved role ("Owner", "DevOps Engineer", …)
//   req.workspaceId — shorthand for req.workspace._id

async function verifyWorkspaceAccess(req, res, next) {
  try {
    const { workspaceId } = req.params;

    // ── 1. ObjectId format check ────────────────────────────────
    if (!workspaceId || !workspaceId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "validation_error",
        message: "workspaceId must be a valid 24-character hex string",
      });
    }

    // ── 2. Load workspace ───────────────────────────────────────
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        error: "not_found",
        message: "Workspace not found",
      });
    }

    // ── 3. Membership check ─────────────────────────────────────
    const userId = req.auth.sub;
    const role = resolveRole(workspace, userId);

    if (!role) {
      return res.status(403).json({
        error: "forbidden",
        message: "You do not have access to this workspace",
      });
    }

    // ── 4. Attach for downstream use ────────────────────────────
    req.workspace = workspace;
    req.workspaceId = workspace._id;
    req.userRole = role;

    next();
  } catch (err) {
    console.error("verifyWorkspaceAccess error:", err);
    return res.status(500).json({
      error: "server_error",
      message: "Failed to verify workspace access",
    });
  }
}

module.exports = { verifyWorkspaceAccess };
