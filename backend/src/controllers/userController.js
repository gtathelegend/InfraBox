const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { resolveRole } = require("../middleware/rbac");

// ─── GET /api/me ────────────────────────────────────────────────────
// Core onboarding endpoint. Called every time the frontend loads the
// dashboard. It performs the "first-login" flow automatically:
//   1. Look up the user by auth0Id
//   2. If they don't exist → create user profile + default workspace
//   3. Return user profile, workspaces, and role in each workspace
//
async function getMe(req, res) {
  try {
    const auth0Id = req.auth.sub;
    const tokenEmail = req.auth.email
      || req.auth[`${process.env.AUTH0_AUDIENCE || "https://infrabox-api"}/email`]
      || "";
    const tokenName = req.auth.name
      || req.auth.nickname
      || tokenEmail.split("@")[0]
      || "InfraBox User";
    const tokenAvatar = req.auth.picture || "";

    // ── Step 1: find or create the User ─────────────────────────────
    let user = await User.findOne({ auth0Id });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      user = await User.create({
        auth0Id,
        email: tokenEmail,
        name: tokenName,
        avatar: tokenAvatar,
      });

      // ── Step 2: create a default workspace for the new user ─────
      await Workspace.create({
        name: `${tokenName}'s Workspace`,
        ownerId: auth0Id,
        members: [
          {
            userId: auth0Id,
            email: tokenEmail,
            role: "Owner",
            joinedAt: new Date(),
          },
        ],
      });
    } else {
      // Returning user — sync profile fields that may have changed in Auth0
      let dirty = false;
      if (tokenName && user.name !== tokenName) { user.name = tokenName; dirty = true; }
      if (tokenAvatar && user.avatar !== tokenAvatar) { user.avatar = tokenAvatar; dirty = true; }
      if (tokenEmail && user.email !== tokenEmail) { user.email = tokenEmail; dirty = true; }
      if (dirty) await user.save();
    }

    // ── Step 3: fetch all workspaces + compute role in each ─────────
    const workspaces = await Workspace.find({
      $or: [
        { ownerId: auth0Id },
        { "members.userId": auth0Id },
      ],
    }).sort({ updatedAt: -1 });

    const workspacesWithRole = workspaces.map((ws) => {
      const role = resolveRole(ws, auth0Id);
      return {
        id: ws._id,
        name: ws.name,
        role,
        repositories: ws.repositories,
        pipelines: ws.pipelines,
        simulations: ws.simulations,
        cloudIntegrations: ws.cloudIntegrations,
        alerts: ws.alerts,
        deployments: ws.deployments,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      };
    });

    return res.status(200).json({
      message: isNewUser
        ? "Welcome to InfraBox! Your account and default workspace have been created."
        : "User profile loaded successfully",
      isNewUser,
      user: {
        id: user._id,
        auth0Id: user.auth0Id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      workspaces: workspacesWithRole,
    });
  } catch (err) {
    console.error("getMe error:", err);

    // Handle duplicate-key race condition gracefully (two concurrent first logins)
    if (err.code === 11000) {
      return res.status(409).json({
        error: "conflict",
        message: "User profile was just created by another request. Please retry.",
      });
    }

    return res.status(500).json({
      error: "server_error",
      message: "Failed to load user profile",
    });
  }
}

module.exports = { getMe };
