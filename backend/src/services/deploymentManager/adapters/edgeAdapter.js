function getEdgeConfig() {
  const apiBase = process.env.EDGE_DEPLOY_API_BASE;
  const apiToken = process.env.EDGE_DEPLOY_API_TOKEN;

  if (!apiBase || !apiToken) {
    const err = new Error("EDGE_DEPLOY_API_BASE and EDGE_DEPLOY_API_TOKEN are required for edge deployments");
    err.status = 400;
    throw err;
  }

  return { apiBase, apiToken };
}

async function deployToEdge({ repository, image, options = {} }) {
  const { apiBase, apiToken } = getEdgeConfig();

  const response = await fetch(`${apiBase}/deploy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceName: options.serviceName || repository.name,
      image,
      replicas: options.replicas || 2,
      region: options.region || "global",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Edge deployment API error: ${response.status} ${text}`);
    err.status = 502;
    throw err;
  }

  const result = await response.json();
  return {
    deploymentUrl: result.url || null,
    metadata: {
      deploymentId: result.deploymentId,
      provider: "edge",
      region: result.region || "global",
    },
  };
}

async function healthCheckEdge({ deploymentUrl }) {
  if (!deploymentUrl) {
    return {
      healthy: false,
      httpStatus: 0,
      readiness: false,
      logs: "No edge URL returned",
    };
  }

  const response = await fetch(`${deploymentUrl}/api/health`).catch(async () => {
    return fetch(deploymentUrl);
  });

  return {
    healthy: response.ok,
    httpStatus: response.status,
    readiness: response.ok,
    logs: "Edge health check completed",
  };
}

async function rollbackEdge({ metadata }) {
  const { apiBase, apiToken } = getEdgeConfig();

  if (!metadata?.deploymentId) {
    return { rolledBack: false, reason: "No edge deploymentId available" };
  }

  const response = await fetch(`${apiBase}/deploy/${metadata.deploymentId}/rollback`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return { rolledBack: false, reason: text || "Edge rollback failed" };
  }

  return { rolledBack: true };
}

module.exports = {
  deployToEdge,
  healthCheckEdge,
  rollbackEdge,
};
