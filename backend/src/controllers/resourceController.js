const Repository = require("../models/Repository");
const Pipeline = require("../models/Pipeline");
const Simulation = require("../models/Simulation");
const Alert = require("../models/Alert");
const Deployment = require("../models/Deployment");

// ─── Generic factory for List + Create ──────────────────────────────
// All five resources follow the same pattern: they belong to a
// workspace and are scoped by workspaceId. This factory avoids
// duplicating identical CRUD logic five times.

function makeListHandler(Model, label) {
  return async (req, res) => {
    try {
      const items = await Model.find({ workspaceId: req.workspaceId })
        .sort({ createdAt: -1 });

      return res.status(200).json({
        message: `${label} retrieved successfully`,
        count: items.length,
        [label.toLowerCase()]: items,
      });
    } catch (err) {
      console.error(`list ${label} error:`, err);
      return res.status(500).json({
        error: "server_error",
        message: `Failed to retrieve ${label.toLowerCase()}`,
      });
    }
  };
}

function makeCreateHandler(Model, label, requiredFields) {
  return async (req, res) => {
    try {
      // Validate required fields
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({
            error: "validation_error",
            message: `${field} is required`,
          });
        }
      }

      const data = {
        ...req.body,
        workspaceId: req.workspaceId,
        createdBy: req.auth.sub,
      };

      const item = await Model.create(data);

      return res.status(201).json({
        message: `${label} created successfully`,
        [label.toLowerCase().replace(/s$/, "")]: item,
      });
    } catch (err) {
      console.error(`create ${label} error:`, err);

      if (err.name === "ValidationError") {
        return res.status(400).json({
          error: "validation_error",
          message: err.message,
        });
      }

      return res.status(500).json({
        error: "server_error",
        message: `Failed to create ${label.toLowerCase().replace(/s$/, "")}`,
      });
    }
  };
}

function makeGetByIdHandler(Model, label) {
  return async (req, res) => {
    try {
      const item = await Model.findOne({
        _id: req.params.resourceId,
        workspaceId: req.workspaceId, // tenant isolation — never return cross-workspace data
      });

      if (!item) {
        return res.status(404).json({
          error: "not_found",
          message: `${label} not found in this workspace`,
        });
      }

      return res.status(200).json({
        [label.toLowerCase()]: item,
      });
    } catch (err) {
      console.error(`get ${label} error:`, err);
      return res.status(500).json({
        error: "server_error",
        message: `Failed to retrieve ${label.toLowerCase()}`,
      });
    }
  };
}

function makeDeleteHandler(Model, label) {
  return async (req, res) => {
    try {
      const item = await Model.findOneAndDelete({
        _id: req.params.resourceId,
        workspaceId: req.workspaceId, // tenant isolation
      });

      if (!item) {
        return res.status(404).json({
          error: "not_found",
          message: `${label} not found in this workspace`,
        });
      }

      return res.status(200).json({
        message: `${label} deleted successfully`,
      });
    } catch (err) {
      console.error(`delete ${label} error:`, err);
      return res.status(500).json({
        error: "server_error",
        message: `Failed to delete ${label.toLowerCase()}`,
      });
    }
  };
}

// ─── Repositories ───────────────────────────────────────────────────
const listRepositories   = makeListHandler(Repository, "Repositories");
const createRepository   = makeCreateHandler(Repository, "Repositories", ["name"]);
const getRepository      = makeGetByIdHandler(Repository, "Repository");
const deleteRepository   = makeDeleteHandler(Repository, "Repository");

// ─── Pipelines ──────────────────────────────────────────────────────
const listPipelines      = makeListHandler(Pipeline, "Pipelines");
const createPipeline     = makeCreateHandler(Pipeline, "Pipelines", ["name"]);
const getPipeline        = makeGetByIdHandler(Pipeline, "Pipeline");
const deletePipeline     = makeDeleteHandler(Pipeline, "Pipeline");

// ─── Simulations ────────────────────────────────────────────────────
const listSimulations    = makeListHandler(Simulation, "Simulations");
const createSimulation   = makeCreateHandler(Simulation, "Simulations", ["name"]);
const getSimulation      = makeGetByIdHandler(Simulation, "Simulation");
const deleteSimulation   = makeDeleteHandler(Simulation, "Simulation");

// ─── Alerts ─────────────────────────────────────────────────────────
const listAlerts         = makeListHandler(Alert, "Alerts");
const createAlert        = makeCreateHandler(Alert, "Alerts", ["title"]);
const getAlert           = makeGetByIdHandler(Alert, "Alert");
const deleteAlert        = makeDeleteHandler(Alert, "Alert");

// ─── Deployments ────────────────────────────────────────────────────
const listDeployments    = makeListHandler(Deployment, "Deployments");
const createDeployment   = makeCreateHandler(Deployment, "Deployments", ["version"]);
const getDeployment      = makeGetByIdHandler(Deployment, "Deployment");
const deleteDeployment   = makeDeleteHandler(Deployment, "Deployment");

module.exports = {
  listRepositories, createRepository, getRepository, deleteRepository,
  listPipelines,    createPipeline,   getPipeline,   deletePipeline,
  listSimulations,  createSimulation, getSimulation, deleteSimulation,
  listAlerts,       createAlert,      getAlert,      deleteAlert,
  listDeployments,  createDeployment, getDeployment, deleteDeployment,
};
