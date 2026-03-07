/* eslint-disable @typescript-eslint/no-require-imports */
const BaseGitProviderAdapter = require("./baseGitProviderAdapter");

class GitHubAdapter extends BaseGitProviderAdapter {
  constructor() {
    super("github");
    this.apiBase = process.env.GITHUB_API_BASE_URL || "https://api.github.com";
  }

  async exchangeCodeForToken(code, redirectUri) {
    const clientId = this.ensureEnv("GITHUB_CLIENT_ID");
    const clientSecret = this.ensureEnv("GITHUB_CLIENT_SECRET");

    return this.request("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri || process.env.GITHUB_REDIRECT_URI,
      }),
    });
  }

  authHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "infrabox-repo-connector",
    };
  }

  async getCurrentUser(accessToken) {
    return this.request(`${this.apiBase}/user`, {
      headers: this.authHeaders(accessToken),
    });
  }

  async listRepositories(accessToken) {
    const repos = await this.request(
      `${this.apiBase}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
      { headers: this.authHeaders(accessToken) }
    );

    return repos.map((repo) => ({
      providerRepoId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      repoUrl: repo.html_url,
      defaultBranch: repo.default_branch || "main",
      owner: repo.owner?.login || "",
    }));
  }

  parseRepoRef(repository) {
    const url = new URL(repository.repoUrl || repository.url);
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    return { owner: parts[0], repo: parts[1]?.replace(/\.git$/, "") };
  }

  async listBranches(repository, accessToken) {
    const { owner, repo } = this.parseRepoRef(repository);
    const branches = await this.request(
      `${this.apiBase}/repos/${owner}/${repo}/branches?per_page=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return branches.map((branch) => ({
      name: branch.name,
      lastCommit: branch.commit?.sha || "",
    }));
  }

  async listCommits(repository, accessToken) {
    const { owner, repo } = this.parseRepoRef(repository);
    const defaultBranch = repository.defaultBranch || "main";

    const commits = await this.request(
      `${this.apiBase}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return commits.map((commit) => ({
      sha: commit.sha,
      author: commit.commit?.author?.name || commit.author?.login || "",
      message: commit.commit?.message || "",
      timestamp: commit.commit?.author?.date || new Date().toISOString(),
    }));
  }

  async listPullRequests(repository, accessToken) {
    const { owner, repo } = this.parseRepoRef(repository);

    const prs = await this.request(
      `${this.apiBase}/repos/${owner}/${repo}/pulls?state=all&per_page=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return prs.map((pr) => ({
      title: pr.title,
      author: pr.user?.login || "",
      status: pr.merged_at ? "merged" : this.normalizeCommitStatus(pr.state),
      createdAt: pr.created_at || new Date().toISOString(),
    }));
  }

  async detectCiConfigs(repository, accessToken) {
    const { owner, repo } = this.parseRepoRef(repository);
    const branch = repository.defaultBranch || "main";
    const detected = [];

    const root = await this.request(
      `${this.apiBase}/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(branch)}`,
      { headers: this.authHeaders(accessToken) }
    );

    const rootNames = new Set((root || []).map((entry) => entry.name));
    if (rootNames.has(".gitlab-ci.yml")) detected.push("gitlab_ci");
    if (rootNames.has("Jenkinsfile")) detected.push("jenkins");
    if (rootNames.has("circle.yml")) detected.push("circleci");

    try {
      const workflows = await this.request(
        `${this.apiBase}/repos/${owner}/${repo}/contents/.github/workflows?ref=${encodeURIComponent(branch)}`,
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

module.exports = GitHubAdapter;
