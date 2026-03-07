/* eslint-disable @typescript-eslint/no-require-imports */
const AWSAdapter = require("./adapters/awsAdapter");
const VercelAdapter = require("./adapters/vercelAdapter");
const VultrAdapter = require("./adapters/vultrAdapter");
const KubernetesAdapter = require("./adapters/kubernetesAdapter");

function createCloudAdapter(integration, credentials) {
  switch ((integration.provider || "").toLowerCase()) {
    case "aws":
      return new AWSAdapter(integration, credentials);
    case "vercel":
      return new VercelAdapter(integration, credentials);
    case "vultr":
      return new VultrAdapter(integration, credentials);
    case "kubernetes":
      return new KubernetesAdapter(integration, credentials);
    default:
      throw new Error(`Unsupported cloud provider: ${integration.provider}`);
  }
}

module.exports = { createCloudAdapter };
