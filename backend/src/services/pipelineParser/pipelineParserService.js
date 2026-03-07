/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs/promises");
const path = require("path");

const ParsedPipeline = require("../../models/ParsedPipeline");
const {
  cloneRepositoryToTempWorkspace,
  cleanupTempWorkspace,
} = require("../repositoryAnalyzer/repositoryCloneService");
const { scanRepositoryFiles } = require("../repositoryAnalyzer/fileScannerService");

function toTitle(input) {
  const label = String(input || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!label) return "Unnamed Stage";

  return label
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function parseInlineArray(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }

  return [trimmed.replace(/^['"]|['"]$/g, "")];
}

function parseYamlListFromBlock(lines, keyRegex) {
  for (let i = 0; i < lines.length; i += 1) {
    const keyMatch = lines[i].match(keyRegex);
    if (!keyMatch) continue;

    const inline = keyMatch[1] || "";
    const inlineValues = parseInlineArray(inline);
    if (inlineValues.length > 0) return inlineValues;

    const values = [];
    const keyIndent = lines[i].match(/^\s*/)[0].length;

    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (!line.trim()) continue;

      const indent = line.match(/^\s*/)[0].length;
      if (indent <= keyIndent) break;

      const listItem = line.match(/^\s*-\s*(.+?)\s*$/);
      if (listItem) {
        const value = listItem[1].replace(/^job:\s*/, "").replace(/^['"]|['"]$/g, "").trim();
        if (value) values.push(value);
      }
    }

    return values;
  }

  return [];
}

function orderJobsByDependencies(jobIds, jobNeeds) {
  const inDegree = new Map();
  const adjacency = new Map();

  for (const jobId of jobIds) {
    inDegree.set(jobId, 0);
    adjacency.set(jobId, []);
  }

  for (const jobId of jobIds) {
    const needs = jobNeeds.get(jobId) || [];
    for (const dep of needs) {
      if (!inDegree.has(dep)) continue;
      adjacency.get(dep).push(jobId);
      inDegree.set(jobId, (inDegree.get(jobId) || 0) + 1);
    }
  }

  const queue = jobIds.filter((jobId) => inDegree.get(jobId) === 0);
  const ordered = [];

  while (queue.length) {
    const current = queue.shift();
    ordered.push(current);

    for (const next of adjacency.get(current) || []) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) {
        queue.push(next);
      }
    }
  }

  if (ordered.length !== jobIds.length) {
    return jobIds;
  }

  return ordered;
}

function parseGitHubActionsWorkflow(content) {
  const lines = String(content || "").split(/\r?\n/);
  const jobsStart = lines.findIndex((line) => /^\s*jobs\s*:\s*$/.test(line));
  if (jobsStart === -1) return [];

  const jobsIndent = lines[jobsStart].match(/^\s*/)[0].length;
  const jobIds = [];
  const jobBlocks = new Map();

  let currentJobId = null;
  let currentJobLines = [];

  for (let i = jobsStart + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.match(/^\s*/)[0].length;

    if (indent <= jobsIndent) {
      if (currentJobId) {
        jobBlocks.set(currentJobId, currentJobLines);
      }
      break;
    }

    const jobMatch = line.match(new RegExp(`^\\s{${jobsIndent + 2}}([A-Za-z0-9_.-]+)\\s*:\\s*$`));
    if (jobMatch) {
      if (currentJobId) {
        jobBlocks.set(currentJobId, currentJobLines);
      }
      currentJobId = jobMatch[1];
      currentJobLines = [];
      jobIds.push(currentJobId);
      continue;
    }

    if (currentJobId) {
      currentJobLines.push(line);
    }
  }

  if (currentJobId) {
    jobBlocks.set(currentJobId, currentJobLines);
  }

  const jobNeeds = new Map();

  for (const jobId of jobIds) {
    const block = jobBlocks.get(jobId) || [];
    const needs = parseYamlListFromBlock(block, /^\s*needs\s*:\s*(.*)$/);
    jobNeeds.set(jobId, needs);
  }

  const orderedJobIds = orderJobsByDependencies(jobIds, jobNeeds);
  const stageNameByJob = new Map(orderedJobIds.map((jobId) => [jobId, toTitle(jobId)]));

  return orderedJobIds.map((jobId, index) => ({
    name: stageNameByJob.get(jobId),
    order: index + 1,
    dependencies: (jobNeeds.get(jobId) || [])
      .filter((dep) => stageNameByJob.has(dep))
      .map((dep) => stageNameByJob.get(dep)),
  }));
}

function parseGitLabCi(content) {
  const lines = String(content || "").split(/\r?\n/);

  const topLevelBlocks = [];
  let currentKey = null;
  let currentLines = [];

  for (const line of lines) {
    const topMatch = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);

    if (topMatch) {
      if (currentKey) {
        topLevelBlocks.push({ key: currentKey, lines: currentLines });
      }
      currentKey = topMatch[1];
      currentLines = [line];
      continue;
    }

    if (currentKey) {
      currentLines.push(line);
    }
  }

  if (currentKey) {
    topLevelBlocks.push({ key: currentKey, lines: currentLines });
  }

  const blockMap = new Map(topLevelBlocks.map((b) => [b.key, b.lines]));
  const reserved = new Set([
    "stages",
    "variables",
    "image",
    "services",
    "before_script",
    "after_script",
    "workflow",
    "include",
    "default",
    "cache",
  ]);

  const stagesBlock = blockMap.get("stages") || [];
  const stageOrder = parseYamlListFromBlock(stagesBlock, /^\s*stages\s*:\s*(.*)$/).map(toTitle);

  const jobs = [];

  for (const block of topLevelBlocks) {
    if (reserved.has(block.key)) continue;

    const stageLine = block.lines.find((line) => /^\s*stage\s*:\s*(.+?)\s*$/.test(line));
    if (!stageLine) continue;

    const stageName = toTitle(stageLine.match(/^\s*stage\s*:\s*(.+?)\s*$/)[1].replace(/^['"]|['"]$/g, ""));

    const needs = [
      ...parseYamlListFromBlock(block.lines, /^\s*needs\s*:\s*(.*)$/),
      ...parseYamlListFromBlock(block.lines, /^\s*dependencies\s*:\s*(.*)$/),
    ];

    jobs.push({
      job: block.key,
      stage: stageName,
      needs,
    });
  }

  const uniqueStageNames = stageOrder.length
    ? [...new Set(stageOrder)]
    : [...new Set(jobs.map((job) => job.stage))];

  const stageDeps = new Map(uniqueStageNames.map((name) => [name, new Set()]));

  if (uniqueStageNames.length > 1) {
    for (let i = 1; i < uniqueStageNames.length; i += 1) {
      stageDeps.get(uniqueStageNames[i]).add(uniqueStageNames[i - 1]);
    }
  }

  const stageByJob = new Map(jobs.map((job) => [job.job, job.stage]));

  for (const job of jobs) {
    for (const need of job.needs) {
      const depStage = stageByJob.get(need);
      if (depStage && depStage !== job.stage) {
        stageDeps.get(job.stage)?.add(depStage);
      }
    }
  }

  return uniqueStageNames.map((stageName, index) => ({
    name: stageName,
    order: index + 1,
    dependencies: [...(stageDeps.get(stageName) || [])],
  }));
}

function parseJenkins(content) {
  const regex = /stage\s*\(\s*["']([^"']+)["']\s*\)/g;
  const names = [];
  let match;

  while ((match = regex.exec(String(content || ""))) !== null) {
    names.push(toTitle(match[1]));
  }

  return names.map((name, index) => ({
    name,
    order: index + 1,
    dependencies: index > 0 ? [names[index - 1]] : [],
  }));
}

function isYaml(file) {
  const lower = file.toLowerCase();
  return lower.endsWith(".yml") || lower.endsWith(".yaml");
}

async function readFile(cloneDir, relativePath) {
  return fs.readFile(path.join(cloneDir, relativePath), "utf8");
}

async function parseRepositoryPipelines(repositoryId) {
  let tempRoot = null;

  try {
    const { repository, tempRoot: tmp, cloneDir } = await cloneRepositoryToTempWorkspace(repositoryId);
    tempRoot = tmp;

    const scanData = await scanRepositoryFiles(cloneDir);
    const files = scanData.files;

    const githubWorkflowFiles = files.filter((file) => file.startsWith(".github/workflows/") && isYaml(file));
    const gitlabFile = files.find((file) => file.toLowerCase() === ".gitlab-ci.yml");
    const jenkinsFile = files.find((file) => file.toLowerCase() === "jenkinsfile");

    const results = [];

    if (githubWorkflowFiles.length) {
      const stages = [];
      const seen = new Set();

      for (const workflowFile of githubWorkflowFiles) {
        const content = await readFile(cloneDir, workflowFile);
        const parsedStages = parseGitHubActionsWorkflow(content);

        for (const stage of parsedStages) {
          const key = stage.name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            stages.push(stage);
          }
        }
      }

      stages.sort((a, b) => a.order - b.order);
      const normalizedStages = stages.map((stage, index) => ({ ...stage, order: index + 1 }));

      if (normalizedStages.length) {
        const doc = await ParsedPipeline.findOneAndUpdate(
          { repositoryId: repository._id, provider: "github_actions" },
          {
            repositoryId: repository._id,
            provider: "github_actions",
            stages: normalizedStages,
            sourceFiles: githubWorkflowFiles,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        results.push(doc);
      }
    }

    if (gitlabFile) {
      const content = await readFile(cloneDir, gitlabFile);
      const stages = parseGitLabCi(content);

      if (stages.length) {
        const doc = await ParsedPipeline.findOneAndUpdate(
          { repositoryId: repository._id, provider: "gitlab_ci" },
          {
            repositoryId: repository._id,
            provider: "gitlab_ci",
            stages,
            sourceFiles: [gitlabFile],
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        results.push(doc);
      }
    }

    if (jenkinsFile) {
      const content = await readFile(cloneDir, jenkinsFile);
      const stages = parseJenkins(content);

      if (stages.length) {
        const doc = await ParsedPipeline.findOneAndUpdate(
          { repositoryId: repository._id, provider: "jenkins" },
          {
            repositoryId: repository._id,
            provider: "jenkins",
            stages,
            sourceFiles: [jenkinsFile],
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        results.push(doc);
      }
    }

    return results;
  } finally {
    await cleanupTempWorkspace(tempRoot);
  }
}

async function getParsedPipelines(repositoryId) {
  const pipelines = await ParsedPipeline.find({ repositoryId }).sort({ provider: 1 });

  if (!pipelines.length) {
    const err = new Error("No parsed pipeline found for this repository");
    err.status = 404;
    throw err;
  }

  return pipelines;
}

module.exports = {
  parseRepositoryPipelines,
  getParsedPipelines,
};
