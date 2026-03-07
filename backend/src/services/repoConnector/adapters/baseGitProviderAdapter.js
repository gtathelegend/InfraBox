class BaseGitProviderAdapter {
  constructor(providerName) {
    this.providerName = providerName;
  }

  get provider() {
    return this.providerName;
  }

  async request(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    let payload = null;
    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      const error = new Error(
        `[${this.provider}] API request failed with status ${response.status}`
      );
      error.status = response.status;
      error.details = payload;
      throw error;
    }

    return payload;
  }

  ensureEnv(name) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  normalizeCommitStatus(status) {
    const val = (status || "").toLowerCase();
    if (["opened", "open", "active"].includes(val)) return "open";
    if (["merged"].includes(val)) return "merged";
    if (["declined"].includes(val)) return "declined";
    if (["closed"].includes(val)) return "closed";
    return "open";
  }
}

module.exports = BaseGitProviderAdapter;
