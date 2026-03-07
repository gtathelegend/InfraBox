function getVultrConfig() {
  const token = process.env.VULTR_API_KEY;
  const apiBase = process.env.VULTR_API_BASE || "https://api.vultr.com";

  if (!token) {
    const err = new Error("VULTR_API_KEY is required for Vultr deployments");
    err.status = 400;
    throw err;
  }

  return { token, apiBase };
}

async function callVultr(path, method = "GET", body = null) {
  const { token, apiBase } = getVultrConfig();
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Vultr API error: ${res.status} ${text}`);
    err.status = 502;
    throw err;
  }

  return res.json();
}

async function deployToVultr({ repository, image, options = {} }) {
  const region = options.region || process.env.VULTR_REGION || "ewr";
  const plan = options.plan || process.env.VULTR_PLAN || "vc2-1c-1gb";

  const instance = await callVultr("/v2/instances", "POST", {
    region,
    plan,
    label: `${repository.name}-infrabox`,
    image: options.baseImage || "docker",
    user_data: options.userData || `#!/bin/bash\ndocker pull ${image}\ndocker run -d -p 80:3000 ${image}`,
  });

  const main = instance.instance || {};

  return {
    deploymentUrl: main.main_ip ? `http://${main.main_ip}` : null,
    metadata: {
      instanceId: main.id,
      region,
      plan,
      status: main.status,
    },
  };
}

async function healthCheckVultr({ deploymentUrl }) {
  if (!deploymentUrl) {
    return {
      healthy: false,
      httpStatus: 0,
      readiness: false,
      logs: "No instance URL available",
    };
  }

  const response = await fetch(`${deploymentUrl}/api/health`).catch(async () => {
    return fetch(deploymentUrl);
  });

  return {
    healthy: response.ok,
    httpStatus: response.status,
    readiness: response.ok,
    logs: "Vultr instance health probe completed",
  };
}

async function rollbackVultr({ metadata }) {
  const instanceId = metadata?.instanceId;
  if (!instanceId) {
    return { rolledBack: false, reason: "No instanceId available for rollback" };
  }

  await callVultr(`/v2/instances/${instanceId}`, "DELETE");
  return { rolledBack: true };
}

module.exports = {
  deployToVultr,
  healthCheckVultr,
  rollbackVultr,
};
