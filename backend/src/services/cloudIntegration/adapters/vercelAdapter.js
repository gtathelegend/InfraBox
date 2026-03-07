/* eslint-disable @typescript-eslint/no-require-imports */
const BaseCloudAdapter = require("./baseCloudAdapter");

class VercelAdapter extends BaseCloudAdapter {
  async getComputeUsage() {
    return {
      cpuUsage: this.normalizeUsage(this.credentials.cpuUsage ?? 33),
      memoryUsage: this.normalizeUsage(this.credentials.memoryUsage ?? 45),
    };
  }

  async getNetworkUsage() {
    return {
      networkUsage: this.normalizeUsage(this.credentials.networkUsage ?? 540.8),
    };
  }

  async getStorageUsage() {
    return {
      storageUsage: this.normalizeUsage(this.credentials.storageUsage ?? 120),
    };
  }

  async getBillingData() {
    return {
      provider: "vercel",
      region: this.integration.region,
      totalCost: this.normalizeUsage(this.credentials.billingTotal ?? 392.8),
      currency: this.credentials.currency || "USD",
      periodStart: this.credentials.periodStart || new Date(Date.now() - 30 * 86400000).toISOString(),
      periodEnd: this.credentials.periodEnd || new Date().toISOString(),
      breakdown: {
        serverless: this.normalizeUsage(this.credentials.serverlessCost ?? 200),
        bandwidth: this.normalizeUsage(this.credentials.bandwidthCost ?? 110),
        storage: this.normalizeUsage(this.credentials.storageCost ?? 82.8),
      },
    };
  }

  async getInstanceInformation() {
    return this.credentials.instances || [
      { id: "vercel-fn-1", type: "serverless", state: "active", region: this.integration.region },
    ];
  }

  async getContainerInformation() {
    return this.credentials.containers || [
      { name: "web-runtime", platform: "vercel", status: "active" },
    ];
  }
}

module.exports = VercelAdapter;
