const mongoose = require("mongoose");

const RepositorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Repository name is required"],
      trim: true,
    },
    url: {
      type: String,
      trim: true,
      default: "",
    },
    provider: {
      type: String,
      enum: ["github", "gitlab", "bitbucket", "other"],
      default: "github",
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "workspaceId is required"],
      index: true,
    },
    createdBy: {
      type: String,
      required: [true, "createdBy is required"],
    },
  },
  {
    timestamps: true,
    toJSON: {
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

// Compound index for fast workspace-scoped queries
RepositorySchema.index({ workspaceId: 1, name: 1 });

module.exports = mongoose.model("Repository", RepositorySchema);
