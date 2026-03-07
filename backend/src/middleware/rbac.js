// ─── Permissions Matrix ─────────────────────────────────────────────
// Maps every platform action to the roles that are allowed to perform it.
// To add a new action, simply add a key here — the middleware picks it up
// automatically.

const PERMISSIONS = {
  "create_workspace":     ["Owner"],
  "invite_members":       ["Owner", "DevOps Engineer"],
  "remove_members":       ["Owner"],
  "connect_repository":   ["Owner", "DevOps Engineer", "Developer"],
  "disconnect_repository":["Owner", "DevOps Engineer"],
  "run_simulation":       ["Owner", "DevOps Engineer", "Developer"],
  "cancel_simulation":    ["Owner", "DevOps Engineer"],
  "view_dashboard":       ["Owner", "DevOps Engineer", "Developer", "Viewer"],
  "manage_pipelines":     ["Owner", "DevOps Engineer"],
  "trigger_deployment":   ["Owner", "DevOps Engineer"],
  "view_deployments":     ["Owner", "DevOps Engineer", "Developer", "Viewer"],
  "manage_alerts":        ["Owner", "DevOps Engineer"],
  "view_alerts":          ["Owner", "DevOps Engineer", "Developer", "Viewer"],
  "manage_integrations":  ["Owner", "DevOps Engineer"],
  "update_workspace":     ["Owner"],
  "delete_workspace":     ["Owner"],
};

// All roles recognised by the platform, ordered by privilege level
const ALL_ROLES = ["Owner", "DevOps Engineer", "Developer", "Viewer"];

// ─── Helper Functions ───────────────────────────────────────────────

/**
 * Check whether a given role is allowed to perform an action.
 * @param {string} role
 * @param {string} action - key from the PERMISSIONS map
 * @returns {boolean}
 */
function hasPermission(role, action) {
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Return every action a role is permitted to perform.
 * Useful for building UI permission indicators.
 * @param {string} role
 * @returns {string[]}
 */
function getPermissionsForRole(role) {
  return Object.keys(PERMISSIONS).filter((action) =>
    PERMISSIONS[action].includes(role)
  );
}

/**
 * Check whether a role string is valid.
 * @param {string} role
 * @returns {boolean}
 */
function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

/**
 * Resolve the user's role inside a workspace.
 * Returns "Owner" when the user is the workspace owner
 * (regardless of the members array), or the role stored
 * in the members array, or null if the user isn't a member.
 */
function resolveRole(workspace, userId) {
  if (workspace.ownerId === userId) return "Owner";
  const member = workspace.members.find((m) => m.userId === userId);
  return member ? member.role : null;
}

// ─── Middleware: checkRole ───────────────────────────────────────────
// Accepts an array of allowed roles and verifies the requester holds
// one of them in the current workspace (req.workspace must be set).
//
// Usage:
//   router.post("/invite", checkJwt, loadWorkspace, checkRole(["Owner","DevOps Engineer"]), handler)

function checkRole(allowedRoles) {
  return (req, res, next) => {
    const workspace = req.workspace;
    if (!workspace) {
      return res.status(500).json({
        error: "server_error",
        message: "Workspace must be loaded before role check (use loadWorkspace middleware)",
      });
    }

    const userId = req.auth.sub;
    const role = resolveRole(workspace, userId);

    if (!role) {
      return res.status(403).json({
        error: "forbidden",
        message: "You are not a member of this workspace",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: "forbidden",
        message: `This action requires one of the following roles: ${allowedRoles.join(", ")}. Your role: ${role}`,
      });
    }

    // Attach resolved role for downstream use
    req.userRole = role;
    next();
  };
}

// ─── Middleware: checkPermission ─────────────────────────────────────
// Higher-level alternative to checkRole — you pass the *action* name
// and it consults the permissions matrix automatically.
//
// Usage:
//   router.post("/invite", checkJwt, loadWorkspace, checkPermission("invite_members"), handler)

function checkPermission(action) {
  const allowedRoles = PERMISSIONS[action];
  if (!allowedRoles) {
    // Fail at startup time if the developer uses an unknown action key
    throw new Error(`[RBAC] Unknown action "${action}". Add it to the PERMISSIONS map.`);
  }
  return checkRole(allowedRoles);
}

module.exports = {
  PERMISSIONS,
  ALL_ROLES,
  hasPermission,
  getPermissionsForRole,
  isValidRole,
  resolveRole,
  checkRole,
  checkPermission,
};
