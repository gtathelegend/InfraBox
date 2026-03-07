/* eslint-disable @typescript-eslint/no-require-imports */
const ResourceMetrics = require("../../models/ResourceMetrics");

async function collectAndPersistMetrics({ workspaceId, integration, adapter }) {
  const [compute, network, storage, instances, containers] = await Promise.all([
    adapter.getComputeUsage(),
    adapter.getNetworkUsage(),
    adapter.getStorageUsage(),
    adapter.getInstanceInformation(),
    adapter.getContainerInformation(),
  ]);

  const metricsDoc = await ResourceMetrics.create({
    workspaceId,
    resourceId: String(integration._id),
    resourceType: integration.provider,
    cpuUsage: Number(compute.cpuUsage || 0),
    memoryUsage: Number(compute.memoryUsage || 0),
    networkUsage: Number(network.networkUsage || 0),
    storageUsage: Number(storage.storageUsage || 0),
    timestamp: new Date(),
  });

  return {
    metrics: metricsDoc,
    instanceInformation: instances,
    containerInformation: containers,
  };
}

module.exports = { collectAndPersistMetrics };
