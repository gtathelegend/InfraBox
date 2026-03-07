/* eslint-disable @typescript-eslint/no-require-imports */
const BaseCloudAdapter = require("./baseCloudAdapter");

class KubernetesAdapter extends BaseCloudAdapter {
  async getComputeUsage() {
    return {
      cpuUsage: this.normalizeUsage(this.credentials.cpuUsage ?? 64),
      memoryUsage: this.normalizeUsage(this.credentials.memoryUsage ?? 72),
    };
  }

  async getNetworkUsage() {
    return {
      networkUsage: this.normalizeUsage(this.credentials.networkUsage ?? 180),
    };
  }

  async getStorageUsage() {
    return {
      storageUsage: this.normalizeUsage(this.credentials.storageUsage ?? 260),
    };
  }

  async getBillingData() {
    return {
      provider: "kubernetes",
      region: this.integration.region,
      totalCost: this.normalizeUsage(this.credentials.billingTotal ?? 0),
      currency: this.credentials.currency || "USD",
      periodStart: this.credentials.periodStart || new Date(Date.now() - 30 * 86400000).toISOString(),
      periodEnd: this.credentials.periodEnd || new Date().toISOString(),
      breakdown: {
        compute: this.normalizeUsage(this.credentials.computeCost ?? 0),
        storage: this.normalizeUsage(this.credentials.storageCost ?? 0),
        network: this.normalizeUsage(this.credentials.networkCost ?? 0),
      },
      note: "Kubernetes billing is usually sourced from the underlying cloud provider.",
    };
  }

  async getInstanceInformation() {
    return this.credentials.instances || [
      { id: "node-1", type: "k8s_node", state: "ready", region: this.integration.region },
    ];
  }

  async getContainerInformation() {
    return this.credentials.containers || [
      { name: "infrabox-api", namespace: "default", status: "Running" },
    ];
  }
}

module.exports = KubernetesAdapter;
