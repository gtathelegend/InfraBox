function getVercelConfig() {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    const err = new Error("VERCEL_TOKEN and VERCEL_PROJECT_ID are required for Vercel deployments");
    err.status = 400;
    throw err;
  }

  return { token, teamId, projectId };
}

async function postVercel(path, body) {
  const { token, teamId } = getVercelConfig();
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

  const res = await fetch(`https://api.vercel.com${path}${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Vercel API error: ${res.status} ${text}`);
    err.status = 502;
    throw err;
  }

  return res.json();
}

async function getVercel(path) {
  const { token, teamId } = getVercelConfig();
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

  const res = await fetch(`https://api.vercel.com${path}${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Vercel API error: ${res.status} ${text}`);
    err.status = 502;
    throw err;
  }

  return res.json();
}

async function waitForCompletion(deploymentId, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const details = await getVercel(`/v13/deployments/${deploymentId}`);
    if (details.readyState === "READY") {
      return details;
    }
    if (details.readyState === "ERROR" || details.readyState === "CANCELED") {
      const err = new Error(`Vercel deployment failed with state ${details.readyState}`);
      err.status = 500;
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const err = new Error("Vercel deployment timed out");
  err.status = 504;
  throw err;
}

async function deployToVercel({ repository, image, options = {} }) {
  const { projectId } = getVercelConfig();

  const deployment = await postVercel(`/v13/deployments`, {
    name: options.projectName || repository.name,
    project: projectId,
    target: options.target || "production",
    // InfraBox can pass built image as a metadata pointer for audit
    meta: {
      infraboxImage: image,
      repositoryId: String(repository._id),
    },
  });

  const completed = await waitForCompletion(deployment.id);

  return {
    deploymentUrl: completed.url ? `https://${completed.url}` : null,
    metadata: {
      deploymentId: completed.id,
      projectId,
      readyState: completed.readyState,
    },
  };
}

async function healthCheckVercel({ deploymentUrl }) {
  if (!deploymentUrl) {
    return {
      healthy: false,
      httpStatus: 0,
      readiness: false,
      logs: "No deployment URL returned from Vercel",
    };
  }

  const response = await fetch(`${deploymentUrl}/api/health`).catch(async () => {
    return fetch(deploymentUrl);
  });

  return {
    healthy: response.ok,
    httpStatus: response.status,
    readiness: response.ok,
    logs: "Vercel health probe completed",
  };
}

async function rollbackVercel({ metadata }) {
  // Vercel rollback is typically an alias switch to previous deployment.
  // Here we provide a safe fallback marker for audit; real alias rollback can be
  // implemented when deployment history/alias config is available.
  return {
    rolledBack: false,
    reason: `Rollback requires alias history for project ${metadata?.projectId || "unknown"}`,
  };
}

module.exports = {
  deployToVercel,
  healthCheckVercel,
  rollbackVercel,
};
