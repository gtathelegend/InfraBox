require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" }); // fallback — won't overwrite .env.local values
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const workspaceRoutes = require("./src/routes/workspaceRoutes");
const userRoutes = require("./src/routes/userRoutes");
const resourceRoutes = require("./src/routes/resourceRoutes");

const app = express();

// ─── Core Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/me", userRoutes);
app.use("/api/workspaces/:workspaceId", resourceRoutes);

// ─── Health Check ───────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Global Error Handler ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      error: "unauthorized",
      message: "Authorization token is missing or invalid",
    });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: "server_error",
    message: "An unexpected error occurred",
  });
});

// ─── MongoDB Connection & Server Start ──────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/infrabox";
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✓ Connected to MongoDB at ${MONGO_URI}`);

    app.listen(PORT, () => {
      console.log(`✓ InfraBox API server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("✗ Failed to start server:", err);
    process.exit(1);
  }
}

start();
