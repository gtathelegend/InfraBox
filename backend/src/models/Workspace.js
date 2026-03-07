const mongoose = require("mongoose");

// ─── Member Sub-Schema ──────────────────────────────────────────────
const MemberSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required for a member"],
    },
    email: {
      type: String,
      required: [true, "email is required for a member"],
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["Owner", "DevOps Engineer", "Developer", "Viewer"],
      default: "Developer",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ─── Workspace Schema ───────────────────────────────────────────────
const WorkspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Workspace name is required"],
      trim: true,
      minlength: [2, "Workspace name must be at least 2 characters"],
      maxlength: [100, "Workspace name must be at most 100 characters"],
    },
    ownerId: {
      type: String,
      required: [true, "ownerId is required"],
      index: true,
    },
    members: {
      type: [MemberSchema],
      default: [],
    },
    repositories: {
      type: [String],
      default: [],
    },
    pipelines: {
      type: [String],
      default: [],
    },
    simulations: {
      type: [String],
      default: [],
    },
    cloudIntegrations: {
      type: [String],
      default: [],
    },
    alerts: {
      type: [String],
      default: [],
    },
    deployments: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true, // auto-creates createdAt & updatedAt
    toJSON: {
      // Map _id → id in JSON output for cleaner API responses
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index so we can efficiently query "all workspaces where I'm a member"
WorkspaceSchema.index({ "members.userId": 1 });

module.exports = mongoose.model("Workspace", WorkspaceSchema);
