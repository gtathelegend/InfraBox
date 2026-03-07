const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access :workspaceId

const { checkJwt } = require("../middleware/auth");
const { verifyWorkspaceAccess } = require("../middleware/tenantIsolation");
const { checkPermission } = require("../middleware/rbac");
const {
  listRepositories, createRepository, getRepository, deleteRepository,
  listPipelines,    createPipeline,   getPipeline,   deletePipeline,
  listSimulations,  createSimulation, getSimulation, deleteSimulation,
  listAlerts,       createAlert,      getAlert,      deleteAlert,
  listDeployments,  createDeployment, getDeployment, deleteDeployment,
} = require("../controllers/resourceController");

// ─── Every resource route requires JWT + workspace membership ───────
router.use(checkJwt);
router.use(verifyWorkspaceAccess);

// ═══════════════════════════════════════════════════════════════════
//  REPOSITORIES
// ═══════════════════════════════════════════════════════════════════
router.get(   "/repositories",              checkPermission("view_dashboard"),       listRepositories);
router.post(  "/repositories",              checkPermission("connect_repository"),   createRepository);
router.get(   "/repositories/:resourceId",  checkPermission("view_dashboard"),       getRepository);
router.delete("/repositories/:resourceId",  checkPermission("disconnect_repository"),deleteRepository);

// ═══════════════════════════════════════════════════════════════════
//  PIPELINES
// ═══════════════════════════════════════════════════════════════════
router.get(   "/pipelines",                 checkPermission("view_dashboard"),       listPipelines);
router.post(  "/pipelines",                 checkPermission("manage_pipelines"),     createPipeline);
router.get(   "/pipelines/:resourceId",     checkPermission("view_dashboard"),       getPipeline);
router.delete("/pipelines/:resourceId",     checkPermission("manage_pipelines"),     deletePipeline);

// ═══════════════════════════════════════════════════════════════════
//  SIMULATIONS
// ═══════════════════════════════════════════════════════════════════
router.get(   "/simulations",               checkPermission("view_dashboard"),       listSimulations);
router.post(  "/simulations",               checkPermission("run_simulation"),       createSimulation);
router.get(   "/simulations/:resourceId",   checkPermission("view_dashboard"),       getSimulation);
router.delete("/simulations/:resourceId",   checkPermission("cancel_simulation"),    deleteSimulation);

// ═══════════════════════════════════════════════════════════════════
//  ALERTS
// ═══════════════════════════════════════════════════════════════════
router.get(   "/alerts",                    checkPermission("view_alerts"),          listAlerts);
router.post(  "/alerts",                    checkPermission("manage_alerts"),        createAlert);
router.get(   "/alerts/:resourceId",        checkPermission("view_alerts"),          getAlert);
router.delete("/alerts/:resourceId",        checkPermission("manage_alerts"),        deleteAlert);

// ═══════════════════════════════════════════════════════════════════
//  DEPLOYMENTS
// ═══════════════════════════════════════════════════════════════════
router.get(   "/deployments",               checkPermission("view_deployments"),     listDeployments);
router.post(  "/deployments",               checkPermission("trigger_deployment"),   createDeployment);
router.get(   "/deployments/:resourceId",   checkPermission("view_deployments"),     getDeployment);
router.delete("/deployments/:resourceId",   checkPermission("trigger_deployment"),   deleteDeployment);

module.exports = router;
