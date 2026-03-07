function normalizeCpuUsage(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace("%", ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeMemoryUsage(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/gb/i, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function checkCompatibility(predicted, server) {
  const memoryUsageGB = normalizeMemoryUsage(predicted.memoryUsageGB ?? predicted.memory_usage);
  const cpuUsage = normalizeCpuUsage(predicted.cpuUsage ?? predicted.cpu_usage);

  if (memoryUsageGB > Number(server.memory || 0)) {
    return {
      status: "INSUFFICIENT_MEMORY",
      recommendation: `Upgrade RAM to at least ${Math.ceil(memoryUsageGB + 1)}GB`,
    };
  }

  if (cpuUsage > Number(server.cpu || 0) * 100) {
    return {
      status: "CPU_BOTTLENECK",
      recommendation: `Increase CPU cores to at least ${Math.ceil(cpuUsage / 100)}`,
    };
  }

  return {
    status: "SAFE",
    recommendation: "Current infrastructure can handle predicted load",
  };
}

function compareWithInfrastructure(trafficSimulation, infrastructure) {
  const scenarios = trafficSimulation?.trafficScenarios || [];

  const evaluations = scenarios.map((scenario) => ({
    users: scenario.users,
    ...checkCompatibility(scenario, infrastructure),
  }));

  const firstUnsafe = evaluations.find((entry) => entry.status !== "SAFE");
  const overall = firstUnsafe || { status: "SAFE", recommendation: "No immediate upgrade required" };

  return {
    status: overall.status,
    recommendation: overall.recommendation,
    scenarios: evaluations,
  };
}

module.exports = {
  checkCompatibility,
  compareWithInfrastructure,
};
