/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const DEFAULT_IMAGE = process.env.SANDBOX_RUNNER_IMAGE || "node:20-alpine";
const DEFAULT_CPUS = process.env.SANDBOX_CPUS || "1";
const DEFAULT_MEMORY = process.env.SANDBOX_MEMORY || "1024m";

async function runDocker(args, options = {}) {
  return execFileAsync("docker", args, {
    windowsHide: true,
    timeout: options.timeout || 0,
    maxBuffer: 1024 * 1024 * 8,
  });
}

async function ensureDockerAvailable() {
  try {
    await runDocker(["version"], { timeout: 20000 });
  } catch (error) {
    const err = new Error("Docker is not available. Ensure Docker daemon is running.");
    err.status = 500;
    err.cause = error;
    throw err;
  }
}

function deriveStageCommand(stageName) {
  const lower = String(stageName || "").toLowerCase();

  if (lower.includes("build")) {
    return "if [ -f package.json ]; then npm ci --no-audit --no-fund || npm install; npm run build --if-present; elif [ -f pom.xml ]; then mvn -q -DskipTests package || true; elif [ -f requirements.txt ]; then echo 'python build step'; else echo 'build step'; fi";
  }

  if (lower.includes("test")) {
    return "if [ -f package.json ]; then npm test --if-present || true; elif [ -f pom.xml ]; then mvn -q test || true; elif [ -f requirements.txt ]; then pytest -q || true; else echo 'test step'; fi";
  }

  if (lower.includes("deploy")) {
    return "echo '[simulation] deploy command executed in sandbox only'; sleep 1";
  }

  if (lower.includes("security")) {
    return "echo '[simulation] security scan executed'; sleep 1";
  }

  return "echo '[simulation] generic stage executed'; sleep 1";
}

function parseCpuPercentage(statsRaw) {
  const match = String(statsRaw || "").match(/^([0-9.]+)%$/);
  return match ? Number(match[1]) : 0;
}

function parseMemoryMiB(statsRaw) {
  const text = String(statsRaw || "");
  const usage = text.split("/")[0]?.trim() || "0MiB";
  const match = usage.match(/^([0-9.]+)([KMG]i?B)$/i);
  if (!match) return 0;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith("g")) return value * 1024;
  if (unit.startsWith("m")) return value;
  if (unit.startsWith("k")) return value / 1024;
  return value;
}

async function collectContainerStats(containerName) {
  try {
    const { stdout } = await runDocker([
      "stats",
      "--no-stream",
      "--format",
      "{{.CPUPerc}}|{{.MemUsage}}",
      containerName,
    ]);

    const [cpuRaw, memRaw] = String(stdout || "").trim().split("|");
    return {
      cpuUsage: parseCpuPercentage(cpuRaw),
      memoryUsage: parseMemoryMiB(memRaw),
    };
  } catch {
    return { cpuUsage: 0, memoryUsage: 0 };
  }
}

async function measureNetworkLatency() {
  const start = Date.now();
  try {
    const response = await fetch("https://example.com", { method: "GET" });
    if (!response.ok) return 0;
    return Date.now() - start;
  } catch {
    return 0;
  }
}

async function runStageInSandbox({ cloneDir, stageName, timeoutMs = 180000 }) {
  await ensureDockerAvailable();

  const containerName = `sandbox-${crypto.randomUUID().slice(0, 12)}`;
  const mountPath = path.resolve(cloneDir);
  const command = deriveStageCommand(stageName);

  const script = [
    "set -e",
    "cp -r /workspace /tmp/workspace",
    "cd /tmp/workspace",
    command,
  ].join("; ");

  const runArgs = [
    "run",
    "-d",
    "--name",
    containerName,
    "--cpus",
    DEFAULT_CPUS,
    "--memory",
    DEFAULT_MEMORY,
    "--pids-limit",
    "128",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=128m",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--network",
    "bridge",
    "--user",
    "1000:1000",
    "--mount",
    `type=bind,source=${mountPath},target=/workspace,readonly`,
    DEFAULT_IMAGE,
    "sh",
    "-lc",
    script,
  ];

  let logs = "";
  let exitCode = 1;

  try {
    await runDocker(runArgs, { timeout: timeoutMs });

    const stats = await collectContainerStats(containerName);

    const waitResult = await runDocker(["wait", containerName], { timeout: timeoutMs + 30000 });
    exitCode = Number(String(waitResult.stdout || "1").trim() || 1);

    const logsResult = await runDocker(["logs", containerName]);
    logs = String(logsResult.stdout || logsResult.stderr || "").trim();

    const latency = await measureNetworkLatency();

    return {
      stageName,
      status: exitCode === 0 ? "success" : "failed",
      exitCode,
      cpuUsage: stats.cpuUsage,
      memoryUsage: stats.memoryUsage,
      latency,
      log: logs || `[simulation] ${stageName}: no logs emitted`,
    };
  } catch (error) {
    return {
      stageName,
      status: "failed",
      exitCode: 1,
      cpuUsage: 0,
      memoryUsage: 0,
      latency: 0,
      log: `[simulation] ${stageName}: execution failed - ${error.message}`,
    };
  } finally {
    try {
      await runDocker(["rm", "-f", containerName]);
    } catch {
      // Ignore cleanup failures.
    }
  }
}

module.exports = {
  runStageInSandbox,
  ensureDockerAvailable,
};
