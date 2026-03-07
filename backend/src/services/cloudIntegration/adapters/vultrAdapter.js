/* eslint-disable @typescript-eslint/no-require-imports */
const BaseCloudAdapter = require("./baseCloudAdapter");

class VultrAdapter extends BaseCloudAdapter {
  async getComputeUsage() {
    return {
      cpuUsage: this.normalizeUsage(this.credentials.cpuUsage ?? 58),
      memoryUsage: this.normalizeUsage(this.credentials.memoryUsage ?? 69),
    };
  }

  async getNetworkUsage() {
    return {
      networkUsage: this.normalizeUsage(this.credentials.networkUsage ?? 310),
    };
  }

  async getStorageUsage() {
    return {
      storageUsage: this.normalizeUsage(this.credentials.storageUsage ?? 420),
    };
  }

  async getBillingData() {
    return {
      provider: "vultr",
      region: this.integration.region,
      totalCost: this.normalizeUsage(this.credentials.billingTotal ?? 238.11),
      currency: this.credentials.currency || "USD",
      periodStart: this.credentials.periodStart || new Date(Date.now() - 30 * 86400000).toISOString(),
      periodEnd: this.credentials.periodEnd || new Date().toISOString(),
      breakdown: {
        instances: this.normalizeUsage(this.credentials.instancesCost ?? 170),
        blockStorage: this.normalizeUsage(this.credentials.blockStorageCost ?? 35),
        bandwidth: this.normalizeUsage(this.credentials.bandwidthCost ?? 33.11),
      },
    };
  }

  async getInstanceInformation() {
    return this.credentials.instances || [
      { id: "vultr-vm-1", type: "instance", state: "running", region: this.integration.region },
    ];
  }

  async getContainerInformation() {
    return this.credentials.containers || [];
  }
}

module.exports = VultrAdapter;
