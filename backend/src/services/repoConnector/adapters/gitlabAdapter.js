/* eslint-disable @typescript-eslint/no-require-imports */
const BaseGitProviderAdapter = require("./baseGitProviderAdapter");

class GitLabAdapter extends BaseGitProviderAdapter {
  constructor() {
    super("gitlab");
    this.apiBase = process.env.GITLAB_API_BASE_URL || "https://gitlab.com/api/v4";
    this.oauthBase = process.env.GITLAB_OAUTH_BASE_URL || "https://gitlab.com";
  }

  async exchangeCodeForToken(code, redirectUri) {
    const clientId = this.ensureEnv("GITLAB_CLIENT_ID");
    const clientSecret = this.ensureEnv("GITLAB_CLIENT_SECRET");

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    });

    if (redirectUri || process.env.GITLAB_REDIRECT_URI) {
      body.append("redirect_uri", redirectUri || process.env.GITLAB_REDIRECT_URI);
    }

    return this.request(`${this.oauthBase}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  authHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async getCurrentUser(accessToken) {
    return this.request(`${this.apiBase}/user`, {
      headers: this.authHeaders(accessToken),
    });
  }

  async listRepositories(accessToken) {
    const repos = await this.request(
      `${this.apiBase}/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at&sort=desc`,
      { headers: this.authHeaders(accessToken) }
    );

    return repos.map((repo) => ({
      providerRepoId: String(repo.id),
      name: repo.name,
      fullName: repo.path_with_namespace,
      repoUrl: repo.web_url,
      defaultBranch: repo.default_branch || "main",
      owner: repo.namespace?.full_path || "",
    }));
  }

  getProjectId(repository) {
    if (repository.providerRepoId) {
      return repository.providerRepoId;
    }

    if (repository.repoUrl) {
      const url = new URL(repository.repoUrl);
      return encodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ""));
    }

    throw new Error("Unable to resolve GitLab project id");
  }

  async listBranches(repository, accessToken) {
    const projectId = this.getProjectId(repository);
    const branches = await this.request(
      `${this.apiBase}/projects/${projectId}/repository/branches?per_page=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return branches.map((branch) => ({
      name: branch.name,
      lastCommit: branch.commit?.id || "",
    }));
  }

  async listCommits(repository, accessToken) {
    const projectId = this.getProjectId(repository);
    const branch = repository.defaultBranch || "main";
    const commits = await this.request(
      `${this.apiBase}/projects/${projectId}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return commits.map((commit) => ({
      sha: commit.id,
      author: commit.author_name || "",
      message: commit.title || commit.message || "",
      timestamp: commit.created_at || new Date().toISOString(),
    }));
  }

  async listPullRequests(repository, accessToken) {
    const projectId = this.getProjectId(repository);

    const pullRequests = await this.request(
      `${this.apiBase}/projects/${projectId}/merge_requests?scope=all&state=all&per_page=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return pullRequests.map((pr) => ({
      title: pr.title,
      author: pr.author?.username || pr.author?.name || "",
      status: pr.state === "merged" ? "merged" : this.normalizeCommitStatus(pr.state),
      createdAt: pr.created_at || new Date().toISOString(),
    }));
  }

  async detectCiConfigs(repository, accessToken) {
    const projectId = this.getProjectId(repository);
    const branch = repository.defaultBranch || "main";
    const detected = [];

    const root = await this.request(
      `${this.apiBase}/projects/${projectId}/repository/tree?ref=${encodeURIComponent(branch)}&per_page=100`,
      { headers: this.authHeaders(accessToken) }
    );

    const rootNames = new Set((root || []).map((entry) => entry.name));
    if (rootNames.has(".gitlab-ci.yml")) detected.push("gitlab_ci");
    if (rootNames.has("Jenkinsfile")) detected.push("jenkins");
    if (rootNames.has("circle.yml")) detected.push("circleci");

    try {
      const workflows = await this.request(
        `${this.apiBase}/projects/${projectId}/repository/tree?path=.github/workflows&ref=${encodeURIComponent(branch)}&per_page=20`,
        { headers: this.authHeaders(accessToken) }
      );
      if (Array.isArray(workflows) && workflows.length > 0) {
        detected.push("github_actions");
      }
    } catch {
      // Missing workflows directory is expected for many repositories.
    }

    return [...new Set(detected)];
  }
}

module.exports = GitLabAdapter;
