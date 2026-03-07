const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
    },
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: [true, "repositoryId is required"],
      index: true,
    },
    lastCommit: {
      type: String,
      default: "",
      trim: true,
    },
    commitCount: {
      type: Number,
      default: 0,
      min: 0,
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

BranchSchema.index({ repositoryId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Branch", BranchSchema);
