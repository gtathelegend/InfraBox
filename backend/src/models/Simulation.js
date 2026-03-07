const mongoose = require("mongoose");

const SimulationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Simulation name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["load_test", "chaos", "stress_test", "integration"],
      default: "load_test",
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
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

SimulationSchema.index({ workspaceId: 1 });

module.exports = mongoose.model("Simulation", SimulationSchema);
