const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Alert title is required"],
      trim: true,
    },
    severity: {
      type: String,
      enum: ["critical", "warning", "info"],
      default: "info",
    },
    status: {
      type: String,
      enum: ["active", "acknowledged", "resolved"],
      default: "active",
    },
    message: {
      type: String,
      default: "",
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

AlertSchema.index({ workspaceId: 1, status: 1 });

module.exports = mongoose.model("Alert", AlertSchema);
