const Workspace = require("../../models/Workspace");
const { resolveRole } = require("../../middleware/rbac");

async function requireWorkspaceMember(workspaceId, userId) {
  if (!workspaceId || !workspaceId.match(/^[0-9a-fA-F]{24}$/)) {
    const err = new Error("workspaceId must be a valid 24-character hex string");
    err.status = 400;
    throw err;
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    const err = new Error("Workspace not found");
    err.status = 404;
    throw err;
  }

  const role = resolveRole(workspace, userId);
  if (!role) {
    const err = new Error("You do not have access to this workspace");
    err.status = 403;
    throw err;
  }

  return { workspace, role };
}

module.exports = { requireWorkspaceMember };
