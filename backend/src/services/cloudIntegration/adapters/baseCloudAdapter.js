class BaseCloudAdapter {
  constructor(integration, credentials) {
    this.integration = integration;
    this.credentials = credentials || {};
  }

  get provider() {
    return this.integration.provider;
  }

  normalizeUsage(value) {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) return 0;
    return Math.round(num * 100) / 100;
  }

  async getComputeUsage() {
    throw new Error(`${this.provider} adapter must implement getComputeUsage()`);
  }

  async getNetworkUsage() {
    throw new Error(`${this.provider} adapter must implement getNetworkUsage()`);
  }

  async getStorageUsage() {
    throw new Error(`${this.provider} adapter must implement getStorageUsage()`);
  }

  async getBillingData() {
    throw new Error(`${this.provider} adapter must implement getBillingData()`);
  }

  async getInstanceInformation() {
    return [];
  }

  async getContainerInformation() {
    return [];
  }
}

module.exports = BaseCloudAdapter;
