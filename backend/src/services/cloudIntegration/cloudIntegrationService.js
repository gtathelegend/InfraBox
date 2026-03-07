/* eslint-disable @typescript-eslint/no-require-imports */
const CloudIntegration = require("../../models/CloudIntegration");
const Workspace = require("../../models/Workspace");
const { encryptCredentials, decryptCredentials } = require("../../utils/credentialVault");
const { createCloudAdapter } = require("./cloudAdapterFactory");
const { collectAndPersistMetrics } = require("./resourceMetricsCollector");

const SUPPORTED_PROVIDERS = ["aws", "vercel", "vultr", "kubernetes"];

function normalizeProvider(provider) {
  return String(provider || "").trim().toLowerCase();
}

function assertSupportedProvider(provider) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    const err = new Error(
      `Unsupported provider \"${provider}\". Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}`
    );
    err.status = 400;
    throw err;
  }
}

async function connectCloudProvider({ workspaceId, provider, credentials, region, userId }) {
  const normalizedProvider = normalizeProvider(provider);
  assertSupportedProvider(normalizedProvider);

  const encrypted = encryptCredentials(credentials || {});

  const integration = await CloudIntegration.findOneAndUpdate(
    { workspaceId, provider: normalizedProvider },
    {
      workspaceId,
      provider: normalizedProvider,
      credentialsEncrypted: encrypted,
      region: region || "global",
      connectedAt: new Date(),
      createdBy: userId,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Workspace.findByIdAndUpdate(
    workspaceId,
    { $addToSet: { cloudIntegrations: normalizedProvider } },
    { new: false }
  );

  return integration;
}

async function getWorkspaceIntegrations(workspaceId, provider) {
  const query = { workspaceId };
  if (provider) {
    const normalizedProvider = normalizeProvider(provider);
    assertSupportedProvider(normalizedProvider);
    query.provider = normalizedProvider;
  }

  return CloudIntegration.find(query).select("+credentialsEncrypted");
}

async function fetchInfrastructureMetrics({ workspaceId, provider }) {
  const integrations = await getWorkspaceIntegrations(workspaceId, provider);
  if (!integrations.length) {
    return [];
  }

  const collected = [];

  for (const integration of integrations) {
    const credentials = decryptCredentials(integration.credentialsEncrypted);
    const adapter = createCloudAdapter(integration, credentials);

    const result = await collectAndPersistMetrics({
      workspaceId,
      integration,
      adapter,
    });

    collected.push({
      integration: {
        id: integration._id,
        provider: integration.provider,
        region: integration.region,
        connectedAt: integration.connectedAt,
      },
      metrics: result.metrics,
      instanceInformation: result.instanceInformation,
      containerInformation: result.containerInformation,
    });
  }

  return collected;
}

async function fetchBillingMetrics({ workspaceId, provider }) {
  const integrations = await getWorkspaceIntegrations(workspaceId, provider);
  if (!integrations.length) {
    return [];
  }

  const billingData = [];

  for (const integration of integrations) {
    const credentials = decryptCredentials(integration.credentialsEncrypted);
    const adapter = createCloudAdapter(integration, credentials);
    const billing = await adapter.getBillingData();

    billingData.push({
      integration: {
        id: integration._id,
        provider: integration.provider,
        region: integration.region,
        connectedAt: integration.connectedAt,
      },
      billing,
    });
  }

  return billingData;
}

module.exports = {
  connectCloudProvider,
  fetchInfrastructureMetrics,
  fetchBillingMetrics,
  SUPPORTED_PROVIDERS,
};
