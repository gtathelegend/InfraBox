/* eslint-disable @typescript-eslint/no-require-imports */
const BaseCloudAdapter = require("./baseCloudAdapter");

class AWSAdapter extends BaseCloudAdapter {
  async getComputeUsage() {
    return {
      cpuUsage: this.normalizeUsage(this.credentials.cpuUsage ?? 42),
      memoryUsage: this.normalizeUsage(this.credentials.memoryUsage ?? 61),
    };
  }

  async getNetworkUsage() {
    return {
      networkUsage: this.normalizeUsage(this.credentials.networkUsage ?? 210.4),
    };
  }

  async getStorageUsage() {
    return {
      storageUsage: this.normalizeUsage(this.credentials.storageUsage ?? 850),
    };
  }

  async getBillingData() {
    return {
      provider: "aws",
      region: this.integration.region,
      totalCost: this.normalizeUsage(this.credentials.billingTotal ?? 1289.24),
      currency: this.credentials.currency || "USD",
      periodStart: this.credentials.periodStart || new Date(Date.now() - 30 * 86400000).toISOString(),
      periodEnd: this.credentials.periodEnd || new Date().toISOString(),
      breakdown: {
        compute: this.normalizeUsage(this.credentials.computeCost ?? 630),
        storage: this.normalizeUsage(this.credentials.storageCost ?? 290),
        network: this.normalizeUsage(this.credentials.networkCost ?? 190),
      },
    };
  }

  async getInstanceInformation() {
    return this.credentials.instances || [
      { id: "i-ec2-main", type: "ec2", state: "running", region: this.integration.region },
    ];
  }

  async getContainerInformation() {
    return this.credentials.containers || [
      { name: "infrabox-api", platform: "ecs", status: "running", cluster: "main" },
    ];
  }
}

module.exports = AWSAdapter;
