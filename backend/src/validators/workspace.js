// ─── Validation Helpers ─────────────────────────────────────────────
// Lightweight input validation so we fail fast before touching the DB.

/**
 * Validate the body of POST /api/workspaces
 */
function validateCreateWorkspace(req, res, next) {
  const { workspaceName } = req.body;

  if (!workspaceName || typeof workspaceName !== "string") {
    return res.status(400).json({
      error: "validation_error",
      message: "workspaceName is required and must be a non-empty string",
    });
  }

  const trimmed = workspaceName.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    return res.status(400).json({
      error: "validation_error",
      message: "workspaceName must be between 2 and 100 characters",
    });
  }

  // Sanitise and forward
  req.body.workspaceName = trimmed;
  next();
}

/**
 * Validate the body of POST /api/workspaces/:workspaceId/invite
 */
function validateInviteMember(req, res, next) {
  const { email, role } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({
      error: "validation_error",
      message: "email is required and must be a non-empty string",
    });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({
      error: "validation_error",
      message: "email must be a valid email address",
    });
  }

  const allowedRoles = ["DevOps Engineer", "Developer", "Viewer"];
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({
      error: "validation_error",
      message: `role must be one of: ${allowedRoles.join(", ")}`,
    });
  }

  req.body.email = email.trim().toLowerCase();
  req.body.role = role || "Developer"; // default role
  next();
}

/**
 * Validate that :workspaceId is a valid Mongo ObjectId
 */
function validateWorkspaceId(req, res, next) {
  const { workspaceId } = req.params;
  if (!workspaceId || !workspaceId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      error: "validation_error",
      message: "workspaceId must be a valid 24-character hex string",
    });
  }
  next();
}

module.exports = {
  validateCreateWorkspace,
  validateInviteMember,
  validateWorkspaceId,
};
