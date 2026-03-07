const GitHubAdapter = require("./adapters/githubAdapter");
const GitLabAdapter = require("./adapters/gitlabAdapter");
const BitbucketAdapter = require("./adapters/bitbucketAdapter");

const adapters = {
  github: new GitHubAdapter(),
  gitlab: new GitLabAdapter(),
  bitbucket: new BitbucketAdapter(),
};

function getProviderAdapter(provider) {
  const normalized = (provider || "").toLowerCase();
  const adapter = adapters[normalized];
  if (!adapter) {
    throw new Error(`Unsupported git provider: ${provider}`);
  }
  return adapter;
}

module.exports = { getProviderAdapter };
