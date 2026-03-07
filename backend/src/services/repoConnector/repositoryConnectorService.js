/* eslint-disable @typescript-eslint/no-require-imports */
const Repository = require("../../models/Repository");
const Branch = require("../../models/Branch");
const Commit = require("../../models/Commit");
const PullRequest = require("../../models/PullRequest");
const GitConnection = require("../../models/GitConnection");
const { getProviderAdapter } = require("./providerAdapterFactory");
const { detectCiCdConfig } = require("./ciDetectionService");

async function connectProvider({ provider, workspaceId, ownerId, code, accessToken, redirectUri }) {
  const adapter = getProviderAdapter(provider);

  let tokenPayload = null;
  if (code) {
    tokenPayload = await adapter.exchangeCodeForToken(code, redirectUri);
  }

  const resolvedAccessToken = accessToken || tokenPayload?.access_token;
  if (!resolvedAccessToken) {
    const err = new Error("Either accessToken or OAuth code is required");
    err.status = 400;
    throw err;
  }

  const user = await adapter.getCurrentUser(resolvedAccessToken);

  const connection = await GitConnection.findOneAndUpdate(
    { provider, workspaceId, ownerId },
    {
      provider,
      workspaceId,
      ownerId,
      accessToken: resolvedAccessToken,
      refreshToken: tokenPayload?.refresh_token || "",
      tokenType: tokenPayload?.token_type || "Bearer",
      providerUserId: String(user.id || user.uuid || ""),
      providerUsername: user.login || user.username || user.display_name || "",
      connectedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    connection,
    providerUser: {
      id: String(user.id || user.uuid || ""),
      username: user.login || user.username || user.display_name || "",
      name: user.name || user.display_name || "",
      email: user.email || "",
    },
  };
}

async function importRepositories({ provider, workspaceId, ownerId }) {
  const connection = await GitConnection.findOne({ provider, workspaceId, ownerId });
  if (!connection) {
    const err = new Error(`No ${provider} connection found for this workspace`);
    err.status = 404;
    throw err;
  }

  const adapter = getProviderAdapter(provider);
  const remoteRepos = await adapter.listRepositories(connection.accessToken);

  const imported = [];

  for (const remoteRepo of remoteRepos) {
    const ciConfigDetected = await detectCiCdConfig(
      adapter,
      {
        ...remoteRepo,
        provider,
      },
      connection.accessToken
    );

    const repoDoc = await Repository.findOneAndUpdate(
      {
        workspaceId,
        provider,
        repoUrl: remoteRepo.repoUrl,
      },
      {
        name: remoteRepo.name,
        provider,
        url: remoteRepo.repoUrl,
        repoUrl: remoteRepo.repoUrl,
        defaultBranch: remoteRepo.defaultBranch,
        workspaceId,
        ownerId,
        createdBy: ownerId,
        branches: [],
        ciConfigDetected,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    imported.push(repoDoc);
  }

  return imported;
}

async function fetchBranches({ repository }) {
  const connection = await GitConnection.findOne({
    provider: repository.provider,
    workspaceId: repository.workspaceId,
    ownerId: repository.ownerId,
  });

  if (!connection) {
    const err = new Error(`No ${repository.provider} connection found for this repository`);
    err.status = 404;
    throw err;
  }

  const adapter = getProviderAdapter(repository.provider);
  const branches = await adapter.listBranches(repository, connection.accessToken);

  await Branch.deleteMany({ repositoryId: repository._id });

  const branchDocs = await Promise.all(
    branches.map((branch) =>
      Branch.create({
        name: branch.name,
        repositoryId: repository._id,
        lastCommit: branch.lastCommit,
        commitCount: 0,
      })
    )
  );

  repository.branches = branches.map((branch) => branch.name);
  await repository.save();

  return branchDocs;
}

async function fetchCommits({ repository }) {
  const connection = await GitConnection.findOne({
    provider: repository.provider,
    workspaceId: repository.workspaceId,
    ownerId: repository.ownerId,
  });

  if (!connection) {
    const err = new Error(`No ${repository.provider} connection found for this repository`);
    err.status = 404;
    throw err;
  }

  const adapter = getProviderAdapter(repository.provider);
  const commits = await adapter.listCommits(repository, connection.accessToken);

  await Commit.deleteMany({ repositoryId: repository._id });

  const commitDocs = await Promise.all(
    commits.map((commit) =>
      Commit.create({
        sha: commit.sha,
        repositoryId: repository._id,
        author: commit.author,
        message: commit.message,
        timestamp: commit.timestamp,
      })
    )
  );

  if (repository.branches?.length) {
    await Branch.updateMany(
      { repositoryId: repository._id },
      {
        commitCount: commitDocs.length,
        lastCommit: commitDocs[0]?.sha || "",
      }
    );
  }

  return commitDocs;
}

async function fetchPullRequests({ repository }) {
  const connection = await GitConnection.findOne({
    provider: repository.provider,
    workspaceId: repository.workspaceId,
    ownerId: repository.ownerId,
  });

  if (!connection) {
    const err = new Error(`No ${repository.provider} connection found for this repository`);
    err.status = 404;
    throw err;
  }

  const adapter = getProviderAdapter(repository.provider);
  const pullRequests = await adapter.listPullRequests(repository, connection.accessToken);

  await PullRequest.deleteMany({ repositoryId: repository._id });

  const pullRequestDocs = await Promise.all(
    pullRequests.map((pr) =>
      PullRequest.create({
        repositoryId: repository._id,
        title: pr.title,
        author: pr.author,
        status: pr.status,
        createdAt: pr.createdAt,
      })
    )
  );

  return pullRequestDocs;
}

module.exports = {
  connectProvider,
  importRepositories,
  fetchBranches,
  fetchCommits,
  fetchPullRequests,
};
