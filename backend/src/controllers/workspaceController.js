const Workspace = require("../models/Workspace");

// ─── Create Workspace ───────────────────────────────────────────────
// POST /api/workspaces
async function createWorkspace(req, res) {
  try {
    const userId = req.auth.sub; // Auth0 user id from JWT
    const userEmail = req.auth[`${process.env.AUTH0_AUDIENCE || "https://infrabox-api"}/email`]
      || req.auth.email
      || "unknown@infrabox.io";

    const workspace = await Workspace.create({
      name: req.body.workspaceName,
      ownerId: userId,
      members: [
        {
          userId,
          email: userEmail,
          role: "Owner",
          joinedAt: new Date(),
        },
      ],
    });

    return res.status(201).json({
      message: "Workspace created successfully",
      workspace,
    });
  } catch (err) {
    console.error("createWorkspace error:", err);

    // Mongoose validation errors
    if (err.name === "ValidationError") {
      return res.status(400).json({
        error: "validation_error",
        message: err.message,
      });
    }

    return res.status(500).json({
      error: "server_error",
      message: "Failed to create workspace",
    });
  }
}

// ─── Get User Workspaces ────────────────────────────────────────────
// GET /api/workspaces
// Returns all workspaces where the user is the owner OR a member.
async function getUserWorkspaces(req, res) {
  try {
    const userId = req.auth.sub;

    const workspaces = await Workspace.find({
      $or: [
        { ownerId: userId },
        { "members.userId": userId },
      ],
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      message: "Workspaces retrieved successfully",
      count: workspaces.length,
      workspaces,
    });
  } catch (err) {
    console.error("getUserWorkspaces error:", err);
    return res.status(500).json({
      error: "server_error",
      message: "Failed to retrieve workspaces",
    });
  }
}

// ─── Invite Member ──────────────────────────────────────────────────
// POST /api/workspaces/:workspaceId/invite
// Only Owner and DevOps Engineer roles can invite (enforced by route-level middleware).
async function inviteMember(req, res) {
  try {
    const { email, role } = req.body;
    const workspace = req.workspace; // pre-loaded by loadWorkspace middleware

    // Prevent duplicate invitations
    const alreadyMember = workspace.members.find(
      (m) => m.email === email
    );
    if (alreadyMember) {
      return res.status(409).json({
        error: "conflict",
        message: `User with email ${email} is already a member of this workspace`,
      });
    }

    // In a production system you would look the user up by email in Auth0's
    // Management API. For now we create a placeholder userId.
    const placeholderUserId = `pending|${email}`;

    workspace.members.push({
      userId: placeholderUserId,
      email,
      role,
      joinedAt: new Date(),
    });

    await workspace.save();

    return res.status(200).json({
      message: `Invitation sent to ${email} with role ${role}`,
      members: workspace.members,
    });
  } catch (err) {
    console.error("inviteMember error:", err);
    return res.status(500).json({
      error: "server_error",
      message: "Failed to invite member",
    });
  }
}

// ─── List Workspace Members ─────────────────────────────────────────
// GET /api/workspaces/:workspaceId/members
async function listMembers(req, res) {
  try {
    const workspace = req.workspace; // pre-loaded by loadWorkspace middleware

    return res.status(200).json({
      message: "Members retrieved successfully",
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      count: workspace.members.length,
      members: workspace.members,
    });
  } catch (err) {
    console.error("listMembers error:", err);
    return res.status(500).json({
      error: "server_error",
      message: "Failed to retrieve members",
    });
  }
}

// ─── Middleware: Load Workspace by ID ───────────────────────────────
// Reusable piece that fetches the workspace from MongoDB and attaches
// it to `req.workspace` so downstream handlers & role-checks can use it.
async function loadWorkspace(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) {
      return res.status(404).json({
        error: "not_found",
        message: "Workspace not found",
      });
    }

    // Authorisation check: the requester must be owner or a member
    const userId = req.auth.sub;
    const isOwner = workspace.ownerId === userId;
    const isMember = workspace.members.some((m) => m.userId === userId);

    if (!isOwner && !isMember) {
      return res.status(403).json({
        error: "forbidden",
        message: "You do not have access to this workspace",
      });
    }

    req.workspace = workspace;
    next();
  } catch (err) {
    console.error("loadWorkspace error:", err);
    return res.status(500).json({
      error: "server_error",
      message: "Failed to load workspace",
    });
  }
}

module.exports = {
  createWorkspace,
  getUserWorkspaces,
  inviteMember,
  listMembers,
  loadWorkspace,
};
