/* eslint-disable @typescript-eslint/no-require-imports */
const { exec } = require("child_process");
const path = require("path");
const Repository = require("../../models/Repository");
const Deployment = require("../../models/Deployment");
const PredictiveIntelligenceReport = require("../../models/PredictiveIntelligenceReport");
const DeploymentConfidenceScore = require("../../models/DeploymentConfidenceScore");

const {
  deployToVercel,
  healthCheckVercel,
  rollbackVercel,
} = require("./adapters/vercelAdapter");
const {
  deployToVultr,
  healthCheckVultr,
  rollbackVultr,
} = require("./adapters/vultrAdapter");
const {
  deployToKubernetes,
  healthCheckKubernetes,
  rollbackKubernetes,
} = require("./adapters/kubernetesAdapter");
const {
  deployToEdge,
  healthCheckEdge,
  rollbackEdge,
} = require("./adapters/edgeAdapter");

const SUPPORTED_TARGETS = ["vercel", "vultr", "kubernetes", "edge"];

function sanitizeTag(value) {
  return String(value || "latest")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, timeout: 20 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(stderr || error.message || "Command failed");
        err.status = 500;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function getSafetyGate(repositoryId, workspaceId) {
  const latestRiskReport = await PredictiveIntelligenceReport.findOne({ repositoryId, workspaceId })
    .sort({ generatedAt: -1 })
    .lean();

  const latestConfidence = await DeploymentConfidenceScore.findOne({ repositoryId, workspaceId })
    .sort({ evaluatedAt: -1 })
    .lean();

  const confidenceScore =
    latestRiskReport?.deploymentConfidence?.confidenceScore || latestConfidence?.confidenceScore || 0;
  const riskLevel =
    latestRiskReport?.deploymentConfidence?.riskLevel || latestConfidence?.riskLevel || "CRITICAL_RISK";

  const isReadyByRiskReport =
    latestRiskReport?.finalRiskReport?.deploymentReadiness?.isReady !== undefined
      ? Boolean(latestRiskReport.finalRiskReport.deploymentReadiness.isReady)
      : null;

  const safeRiskLevels = ["SAFE_TO_DEPLOY", "LOW_RISK", "MEDIUM_RISK"];
  const isSafeByScore = confidenceScore >= 70 && safeRiskLevels.includes(riskLevel);
  const safe = isReadyByRiskReport === null ? isSafeByScore : isReadyByRiskReport && isSafeByScore;

  return {
    safe,
    confidenceScore,
    riskLevel,
    readinessFromPredictiveLayer: isReadyByRiskReport,
    recommendations:
      latestRiskReport?.deploymentConfidence?.recommendations || latestConfidence?.recommendations || [],
  };
}

function resolveEnvironment(targetEnvironment) {
  const normalized = String(targetEnvironment || "").toLowerCase();
  if (!SUPPORTED_TARGETS.includes(normalized)) {
    const err = new Error(
      `targetEnvironment must be one of: ${SUPPORTED_TARGETS.join(", ")}`
    );
    err.status = 400;
    throw err;
  }
  return normalized;
}

function resolveRegistryConfig(repositoryName) {
  const registryType = process.env.CONTAINER_REGISTRY_TYPE || "docker_hub";
  const registryPrefix = process.env.CONTAINER_REGISTRY_PREFIX || "infrabox";
  const imageName = sanitizeTag(repositoryName || "app-image");
  const versionTag = sanitizeTag(process.env.DEPLOY_VERSION_TAG || `${Date.now()}`);

  const fullImageName =
    registryType === "private" || registryType === "cloud"
      ? `${registryPrefix}/${imageName}:${versionTag}`
      : `${registryPrefix}/${imageName}:${versionTag}`;

  return {
    registryType,
    fullImageName,
    versionTag,
  };
}

function resolveRepoPath(repository) {
  const configuredPath = process.env.DEPLOY_REPOSITORY_BASE_PATH;
  if (!configuredPath) {
    return process.cwd();
  }
  return path.join(configuredPath, repository.name);
}

async function buildContainerImage({ repository, imageName }) {
  const repoPath = resolveRepoPath(repository);
  const command = `docker build -t ${imageName} .`;
  const result = await runCommand(command, repoPath);

  return {
    step: "build_container",
    command,
    output: result.stdout,
    success: true,
  };
}

async function pushContainerImage({ imageName }) {
  const command = `docker push ${imageName}`;
  const result = await runCommand(command);

  return {
    step: "push_container_image",
    command,
    output: result.stdout,
    success: true,
  };
}

async function deployService({ repository, targetEnvironment, imageName, options = {} }) {
  if (targetEnvironment === "vercel") {
    const deployed = await deployToVercel({ repository, image: imageName, options });
    return { ...deployed, step: "deploy_service" };
  }

  if (targetEnvironment === "vultr") {
    const deployed = await deployToVultr({ repository, image: imageName, options });
    return { ...deployed, step: "deploy_service" };
  }

  if (targetEnvironment === "kubernetes") {
    const deployed = await deployToKubernetes({ repository, image: imageName, options });
    return { ...deployed, step: "deploy_service" };
  }

  const deployed = await deployToEdge({ repository, image: imageName, options });
  return { ...deployed, step: "deploy_service" };
}

async function verifyHealth({ targetEnvironment, deploymentUrl, metadata }) {
  if (targetEnvironment === "vercel") {
    return healthCheckVercel({ deploymentUrl, metadata });
  }
  if (targetEnvironment === "vultr") {
    return healthCheckVultr({ deploymentUrl, metadata });
  }
  if (targetEnvironment === "kubernetes") {
    return healthCheckKubernetes({ deploymentUrl, metadata });
  }
  return healthCheckEdge({ deploymentUrl, metadata });
}

async function rollbackDeployment({ targetEnvironment, deploymentUrl, metadata }) {
  if (targetEnvironment === "vercel") {
    return rollbackVercel({ deploymentUrl, metadata });
  }
  if (targetEnvironment === "vultr") {
    return rollbackVultr({ deploymentUrl, metadata });
  }
  if (targetEnvironment === "kubernetes") {
    return rollbackKubernetes({ deploymentUrl, metadata });
  }
  return rollbackEdge({ deploymentUrl, metadata });
}

async function runDeployment({ repositoryId, targetEnvironment, triggeredBy, options = {} }) {
  const target = resolveEnvironment(targetEnvironment);

  const repository = await Repository.findById(repositoryId);
  if (!repository) {
    const err = new Error("Repository not found");
    err.status = 404;
    throw err;
  }

  const safetyGate = await getSafetyGate(repositoryId, repository.workspaceId);
  if (!safetyGate.safe) {
    const err = new Error(
      `Deployment blocked by predictive safety gate (confidence=${safetyGate.confidenceScore}, risk=${safetyGate.riskLevel})`
    );
    err.status = 409;
    err.details = safetyGate;
    throw err;
  }

  const registry = resolveRegistryConfig(repository.name);

  const deployment = await Deployment.create({
    version: registry.versionTag,
    environment: "production",
    status: "in_progress",
    workspaceId: repository.workspaceId,
    createdBy: triggeredBy,
  });

  const timeline = [];
  let deploymentUrl = null;
  let providerMetadata = null;

  try {
    const buildResult = await buildContainerImage({ repository, imageName: registry.fullImageName });
    timeline.push(buildResult);

    const pushResult = await pushContainerImage({ imageName: registry.fullImageName });
    timeline.push(pushResult);

    const deployed = await deployService({
      repository,
      targetEnvironment: target,
      imageName: registry.fullImageName,
      options,
    });

    deploymentUrl = deployed.deploymentUrl;
    providerMetadata = deployed.metadata;

    timeline.push({
      step: "deploy_service",
      success: true,
      environment: target,
      deploymentUrl,
      metadata: providerMetadata,
    });

    const health = await verifyHealth({
      targetEnvironment: target,
      deploymentUrl,
      metadata: providerMetadata,
    });

    timeline.push({
      step: "verify_health",
      success: Boolean(health.healthy),
      health,
    });

    if (!health.healthy) {
      const rollback = await rollbackDeployment({
        targetEnvironment: target,
        deploymentUrl,
        metadata: providerMetadata,
      });
      timeline.push({ step: "rollback", success: rollback.rolledBack, rollback });

      deployment.status = rollback.rolledBack ? "rolled_back" : "failed";
      await deployment.save();

      return {
        deploymentId: String(deployment._id),
        deploymentStatus: deployment.status,
        deploymentUrl,
        timeline,
      };
    }

    deployment.status = "succeeded";
    await deployment.save();

    return {
      deploymentId: String(deployment._id),
      deploymentStatus: "succeeded",
      deploymentUrl,
      image: registry.fullImageName,
      targetEnvironment: target,
      timeline,
      safetyGate,
    };
  } catch (err) {
    deployment.status = "failed";
    await deployment.save();

    timeline.push({
      step: "error",
      success: false,
      message: err.message,
    });

    throw Object.assign(err, {
      deploymentId: String(deployment._id),
      deploymentUrl,
      timeline,
    });
  }
}

module.exports = {
  SUPPORTED_TARGETS,
  runDeployment,
};
