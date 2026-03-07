/* eslint-disable @typescript-eslint/no-require-imports */
const ParsedPipeline = require("../../models/ParsedPipeline");
const PipelineMetrics = require("../../models/PipelineMetrics");
const GitConnection = require("../../models/GitConnection");
const { parseRepositoryPipelines } = require("./pipelineParserService");

function secondsBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? Math.round(ms / 1000) : 0;
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["success", "succeeded", "passed", "pass", "completed"].includes(value)) return "success";
  if (["failure", "failed", "error"].includes(value)) return "failed";
  if (["cancelled", "canceled"].includes(value)) return "cancelled";
  if (["skipped"].includes(value)) return "skipped";
  if (["running", "in_progress", "pending"].includes(value)) return "running";
  return "unknown";
}

function parseRepoFromUrl(repoUrl) {
  if (!repoUrl) return { owner: null, repo: null, pathWithNamespace: null };

  try {
    const url = new URL(repoUrl);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    const parts = path.split("/");

    return {
      owner: parts[0] || null,
      repo: parts[1] ? parts[1].replace(/\.git$/, "") : null,
      pathWithNamespace: path.replace(/\.git$/, ""),
    };
  } catch {
    return { owner: null, repo: null, pathWithNamespace: null };
  }
}

function buildHeaders(provider, token) {
  if (provider === "github") {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "infrabox-pipeline-metrics",
    };
  }

  if (provider === "gitlab") {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
  }

  return {
    Accept: "application/json",
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`Request failed: ${response.status} ${response.statusText}`);
    err.details = errorText;
    throw err;
  }

  return response.json();
}

async function getConnection(repository, provider) {
  return GitConnection.findOne({
    provider,
    workspaceId: repository.workspaceId,
    ownerId: repository.ownerId,
  });
}

async function collectGitHubMetrics({ repository, parsedPipeline }) {
  const connection = await getConnection(repository, "github");
  if (!connection?.accessToken) return [];

  const base = process.env.GITHUB_API_BASE_URL || "https://api.github.com";
  const parsed = parseRepoFromUrl(repository.repoUrl || repository.url);
  if (!parsed.owner || !parsed.repo) return [];

  const headers = buildHeaders("github", connection.accessToken);

  const runs = await requestJson(
    `${base}/repos/${parsed.owner}/${parsed.repo}/actions/runs?per_page=20&status=completed`,
    { headers }
  );

  const metrics = [];

  for (const run of runs.workflow_runs || []) {
    const jobsResult = await requestJson(
      `${base}/repos/${parsed.owner}/${parsed.repo}/actions/runs/${run.id}/jobs?per_page=100`,
      { headers }
    );

    const runDuration = secondsBetween(run.run_started_at, run.updated_at);

    for (const job of jobsResult.jobs || []) {
      const stageName = job.name || "Unnamed Stage";
      const duration = secondsBetween(job.started_at, job.completed_at);
      const status = normalizeStatus(job.conclusion || run.conclusion || run.status);

      metrics.push({
        pipelineId: parsedPipeline._id,
        stageName,
        executionTime: runDuration,
        duration,
        status,
        retryCount: run.run_attempt && run.run_attempt > 1 ? run.run_attempt - 1 : 0,
        timestamp: job.completed_at || run.updated_at || new Date().toISOString(),
      });
    }
  }

  return metrics;
}

async function collectGitLabMetrics({ repository, parsedPipeline }) {
  const connection = await getConnection(repository, "gitlab");
  if (!connection?.accessToken) return [];

  const base = process.env.GITLAB_API_BASE_URL || "https://gitlab.com/api/v4";
  const parsed = parseRepoFromUrl(repository.repoUrl || repository.url);
  if (!parsed.pathWithNamespace) return [];

  const projectId = encodeURIComponent(parsed.pathWithNamespace);
  const headers = buildHeaders("gitlab", connection.accessToken);

  const pipelines = await requestJson(
    `${base}/projects/${projectId}/pipelines?per_page=20&order_by=updated_at&sort=desc`,
    { headers }
  );

  const metrics = [];

  for (const pipeline of pipelines || []) {
    const [details, jobs] = await Promise.all([
      requestJson(`${base}/projects/${projectId}/pipelines/${pipeline.id}`, { headers }),
      requestJson(`${base}/projects/${projectId}/pipelines/${pipeline.id}/jobs?per_page=100`, { headers }),
    ]);

    const executionTime = Math.round(Number(details.duration || 0));

    for (const job of jobs || []) {
      metrics.push({
        pipelineId: parsedPipeline._id,
        stageName: job.stage || job.name || "Unnamed Stage",
        executionTime,
        duration: Math.round(Number(job.duration || 0)),
        status: normalizeStatus(job.status),
        retryCount: Number(job.retries_count || job.retry || 0),
        timestamp: job.finished_at || job.created_at || details.updated_at || new Date().toISOString(),
      });
    }
  }

  return metrics;
}

function buildJenkinsAuthHeader() {
  const user = process.env.JENKINS_USER || "";
  const token = process.env.JENKINS_API_TOKEN || "";

  if (!user || !token) return null;

  const encoded = Buffer.from(`${user}:${token}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

async function collectJenkinsMetrics({ repository, parsedPipeline }) {
  const base = process.env.JENKINS_BASE_URL;
  if (!base) return [];

  const repoSlug = parseRepoFromUrl(repository.repoUrl || repository.url).repo || repository.name;
  const jobName = process.env.JENKINS_JOB_NAME
    || `${process.env.JENKINS_JOB_PREFIX || ""}${repoSlug}`;

  const authHeader = buildJenkinsAuthHeader() || {};
  const headers = {
    ...authHeader,
    Accept: "application/json",
  };

  const buildsResponse = await requestJson(
    `${base.replace(/\/$/, "")}/job/${encodeURIComponent(jobName)}/api/json?tree=builds[number,result,timestamp,duration,url]{0,20}`,
    { headers }
  );

  const metrics = [];

  for (const build of buildsResponse.builds || []) {
    let stageRows = [];

    try {
      const wf = await requestJson(
        `${base.replace(/\/$/, "")}/job/${encodeURIComponent(jobName)}/${build.number}/wfapi/describe`,
        { headers }
      );

      stageRows = (wf.stages || []).map((stage) => ({
        stageName: stage.name || "Unnamed Stage",
        duration: Math.round((Number(stage.durationMillis || 0) || 0) / 1000),
        status: normalizeStatus(stage.status),
      }));
    } catch {
      stageRows = [];
    }

    if (!stageRows.length) {
      stageRows = [
        {
          stageName: "Build",
          duration: Math.round((Number(build.duration || 0) || 0) / 1000),
          status: normalizeStatus(build.result),
        },
      ];
    }

    for (const stage of stageRows) {
      metrics.push({
        pipelineId: parsedPipeline._id,
        stageName: stage.stageName,
        executionTime: Math.round((Number(build.duration || 0) || 0) / 1000),
        duration: stage.duration,
        status: stage.status,
        retryCount: 0,
        timestamp: new Date(Number(build.timestamp || Date.now())).toISOString(),
      });
    }
  }

  return metrics;
}

async function collectMetricsForPipeline({ repository, parsedPipeline }) {
  if (parsedPipeline.provider === "github_actions") {
    return collectGitHubMetrics({ repository, parsedPipeline });
  }

  if (parsedPipeline.provider === "gitlab_ci") {
    return collectGitLabMetrics({ repository, parsedPipeline });
  }

  if (parsedPipeline.provider === "jenkins") {
    return collectJenkinsMetrics({ repository, parsedPipeline });
  }

  return [];
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function aggregateStageMetrics(records) {
  const groups = new Map();

  for (const row of records) {
    const key = row.stageName;
    if (!groups.has(key)) {
      groups.set(key, {
        stageName: key,
        count: 0,
        success: 0,
        failed: 0,
        totalDuration: 0,
        totalExecutionTime: 0,
        totalRetryCount: 0,
      });
    }

    const group = groups.get(key);
    group.count += 1;
    group.totalDuration += Number(row.duration || 0);
    group.totalExecutionTime += Number(row.executionTime || 0);
    group.totalRetryCount += Number(row.retryCount || 0);

    if (row.status === "success") group.success += 1;
    if (row.status === "failed") group.failed += 1;
  }

  return [...groups.values()]
    .map((group) => {
      const averageDuration = group.count ? group.totalDuration / group.count : 0;
      const failureRate = group.count ? (group.failed / group.count) * 100 : 0;
      const successRate = group.count ? (group.success / group.count) * 100 : 0;

      return {
        stageName: group.stageName,
        executions: group.count,
        averageStageTimeSeconds: Math.round(averageDuration),
        averageStageTime: formatDuration(averageDuration),
        averageExecutionTimeSeconds: Math.round(group.totalExecutionTime / group.count || 0),
        failureRate: Math.round(failureRate * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        averageRetryCount: Math.round((group.totalRetryCount / group.count) * 100) / 100,
      };
    })
    .sort((a, b) => a.stageName.localeCompare(b.stageName));
}

function aggregatePipelineSuccessRate(records) {
  const byExecution = new Map();

  for (const row of records) {
    const key = `${row.pipelineId}:${new Date(row.timestamp).toISOString()}`;
    if (!byExecution.has(key)) {
      byExecution.set(key, { total: 0, failed: 0 });
    }

    const aggregate = byExecution.get(key);
    aggregate.total += 1;
    if (row.status === "failed") aggregate.failed += 1;
  }

  const executions = [...byExecution.values()];
  if (!executions.length) return 0;

  const successful = executions.filter((run) => run.failed === 0).length;
  return Math.round((successful / executions.length) * 10000) / 100;
}

async function collectPipelineMetrics(repository, parsedPipelines) {
  const allRows = [];

  for (const parsedPipeline of parsedPipelines) {
    let rows = [];
    try {
      rows = await collectMetricsForPipeline({ repository, parsedPipeline });
    } catch (err) {
      console.warn(
        `[pipeline-metrics] failed collecting provider ${parsedPipeline.provider}:`,
        err.message
      );
      rows = [];
    }

    await PipelineMetrics.deleteMany({ pipelineId: parsedPipeline._id });

    if (rows.length) {
      const created = await PipelineMetrics.insertMany(rows);
      allRows.push(...created);
    }
  }

  return allRows;
}

async function fetchPipelineMetrics(repository) {
  let parsedPipelines = await ParsedPipeline.find({ repositoryId: repository._id });

  if (!parsedPipelines.length) {
    parsedPipelines = await parseRepositoryPipelines(repository._id);
  }

  if (!parsedPipelines.length) {
    const err = new Error("No pipeline configuration found for this repository");
    err.status = 404;
    throw err;
  }

  const rows = await collectPipelineMetrics(repository, parsedPipelines);

  const stageStats = aggregateStageMetrics(rows);
  const pipelineSuccessRate = aggregatePipelineSuccessRate(rows);

  return {
    repositoryId: String(repository._id),
    pipelineCount: parsedPipelines.length,
    totalStageExecutions: rows.length,
    pipelineSuccessRate,
    stageMetrics: stageStats,
    rawMetrics: rows,
  };
}

module.exports = {
  fetchPipelineMetrics,
};
