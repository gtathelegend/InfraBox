/* eslint-disable @typescript-eslint/no-require-imports */
const BaseGitProviderAdapter = require("./baseGitProviderAdapter");

class BitbucketAdapter extends BaseGitProviderAdapter {
  constructor() {
    super("bitbucket");
    this.apiBase = process.env.BITBUCKET_API_BASE_URL || "https://api.bitbucket.org/2.0";
  }

  async exchangeCodeForToken(code, redirectUri) {
    const clientId = this.ensureEnv("BITBUCKET_CLIENT_ID");
    const clientSecret = this.ensureEnv("BITBUCKET_CLIENT_SECRET");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
    });

    if (redirectUri || process.env.BITBUCKET_REDIRECT_URI) {
      body.append("redirect_uri", redirectUri || process.env.BITBUCKET_REDIRECT_URI);
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    return this.request(`${this.apiBase}/site/oauth2/access_token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

  authHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
  }

  async getCurrentUser(accessToken) {
    const [user, emails] = await Promise.all([
      this.request(`${this.apiBase}/user`, { headers: this.authHeaders(accessToken) }),
      this.request(`${this.apiBase}/user/emails`, { headers: this.authHeaders(accessToken) }),
    ]);

    const primary = (emails.values || []).find((item) => item.is_primary) || emails.values?.[0];
    return {
      uuid: user.uuid,
      username: user.username || user.nickname || "",
      display_name: user.display_name || "",
      email: primary?.email || "",
    };
  }

  async listRepositories(accessToken) {
    const repos = await this.request(
      `${this.apiBase}/repositories?role=member&pagelen=100&sort=-updated_on`,
      { headers: this.authHeaders(accessToken) }
    );

    return (repos.values || []).map((repo) => ({
      providerRepoId: repo.uuid,
      name: repo.name,
      fullName: repo.full_name,
      repoUrl: repo.links?.html?.href || "",
      defaultBranch: repo.mainbranch?.name || "main",
      owner: repo.workspace?.slug || "",
    }));
  }

  parseRepoRef(repository) {
    if (repository.fullName) {
      const [workspace, slug] = repository.fullName.split("/");
      return { workspace, slug };
    }

    const url = new URL(repository.repoUrl);
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    return { workspace: parts[0], slug: parts[1]?.replace(/\.git$/, "") };
  }

  async listBranches(repository, accessToken) {
    const { workspace, slug } = this.parseRepoRef(repository);
    const branchResponse = await this.request(
      `${this.apiBase}/repositories/${workspace}/${slug}/refs/branches?pagelen=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return (branchResponse.values || []).map((branch) => ({
      name: branch.name,
      lastCommit: branch.target?.hash || "",
    }));
  }

  async listCommits(repository, accessToken) {
    const { workspace, slug } = this.parseRepoRef(repository);
    const branch = repository.defaultBranch || "main";
    const commitResponse = await this.request(
      `${this.apiBase}/repositories/${workspace}/${slug}/commits/${encodeURIComponent(branch)}?pagelen=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return (commitResponse.values || []).map((commit) => ({
      sha: commit.hash,
      author: commit.author?.user?.display_name || commit.author?.raw || "",
      message: commit.message || "",
      timestamp: commit.date || new Date().toISOString(),
    }));
  }

  async listPullRequests(repository, accessToken) {
    const { workspace, slug } = this.parseRepoRef(repository);
    const pullRequestResponse = await this.request(
      `${this.apiBase}/repositories/${workspace}/${slug}/pullrequests?state=OPEN&state=MERGED&state=DECLINED&pagelen=100`,
      { headers: this.authHeaders(accessToken) }
    );

    return (pullRequestResponse.values || []).map((pr) => ({
      title: pr.title,
      author: pr.author?.display_name || pr.author?.nickname || "",
      status: this.normalizeCommitStatus(pr.state),
      createdAt: pr.created_on || new Date().toISOString(),
    }));
  }

  async detectCiConfigs(repository, accessToken) {
    const { workspace, slug } = this.parseRepoRef(repository);
    const branch = repository.defaultBranch || "main";
    const detected = [];

    const root = await this.request(
      `${this.apiBase}/repositories/${workspace}/${slug}/src/${encodeURIComponent(branch)}/`,
      { headers: this.authHeaders(accessToken) }
    );

    const rootNames = new Set((root.values || []).map((entry) => entry.path?.replace(/\/$/, "")));
    if (rootNames.has(".gitlab-ci.yml")) detected.push("gitlab_ci");
    if (rootNames.has("Jenkinsfile")) detected.push("jenkins");
    if (rootNames.has("circle.yml")) detected.push("circleci");

    try {
      const workflows = await this.request(
        `${this.apiBase}/repositories/${workspace}/${slug}/src/${encodeURIComponent(branch)}/.github/workflows/`,
        { headers: this.authHeaders(accessToken) }
      );
      if ((workflows.values || []).length > 0) {
        detected.push("github_actions");
      }
    } catch {
      // Missing workflows directory is expected for many repositories.
    }

    return [...new Set(detected)];
  }
}

module.exports = BitbucketAdapter;
