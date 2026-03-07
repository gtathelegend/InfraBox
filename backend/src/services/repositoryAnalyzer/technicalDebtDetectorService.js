/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const Dependency = require("../../models/Dependency");
const RepositoryAnalysis = require("../../models/RepositoryAnalysis");
const TechnicalDebtReport = require("../../models/TechnicalDebtReport");
const { runRepositoryAnalysis } = require("./repositoryAnalyzerService");
const {
  cloneRepositoryToTempWorkspace,
  cleanupTempWorkspace,
} = require("./repositoryCloneService");
const { scanRepositoryFiles } = require("./fileScannerService");

const execFileAsync = promisify(execFile);

const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".java"]);

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function fetchJson(url, timeoutMs = 5000) {
  const { controller, timer } = withTimeout(timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cleanVersion(version) {
  return String(version || "")
    .trim()
    .replace(/^[~^<>=\s]+/, "")
    .replace(/[,;].*$/, "")
    .replace(/\s+\(.*\)$/, "")
    .replace(/^v/i, "");
}

function compareSemverish(a, b) {
  const sa = cleanVersion(a);
  const sb = cleanVersion(b);
  if (!sa || !sb) return null;
  if (sa === sb) return 0;

  const split = (value) => value.split(/[.+-]/).map((token) => (/^\d+$/.test(token) ? Number(token) : token));
  const pa = split(sa);
  const pb = split(sb);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i += 1) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;

    if (typeof va === "number" && typeof vb === "number") {
      if (va > vb) return 1;
      if (va < vb) return -1;
      continue;
    }

    const aStr = String(va);
    const bStr = String(vb);
    if (aStr > bStr) return 1;
    if (aStr < bStr) return -1;
  }

  return 0;
}

async function fetchLatestNpmVersion(name) {
  const data = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
  return data?.version || null;
}

async function fetchLatestPyPiVersion(name) {
  const data = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  return data?.info?.version || null;
}

async function fetchLatestMavenVersion(name) {
  const [groupId, artifactId] = String(name).split(":");
  if (!groupId || !artifactId) return null;

  const q = encodeURIComponent(`g:"${groupId}" AND a:"${artifactId}"`);
  const data = await fetchJson(`https://search.maven.org/solrsearch/select?q=${q}&rows=1&wt=json`);
  return data?.response?.docs?.[0]?.latestVersion || null;
}

async function detectOutdatedDependencies(dependencies) {
  const results = [];
  const limited = dependencies.slice(0, 80);

  for (const dep of limited) {
    const currentVersion = cleanVersion(dep.version);
    if (!currentVersion || currentVersion === "unknown") continue;

    let latest = null;
    let registry = null;

    if (dep.name.includes(":")) {
      latest = await fetchLatestMavenVersion(dep.name);
      registry = latest ? "maven" : null;
    } else if (dep.name.startsWith("@") || ["dev", "peer", "optional"].includes(dep.type)) {
      latest = await fetchLatestNpmVersion(dep.name);
      registry = latest ? "npm" : null;
      if (!latest) {
        latest = await fetchLatestPyPiVersion(dep.name);
        registry = latest ? "pypi" : null;
      }
    } else {
      latest = await fetchLatestNpmVersion(dep.name);
      registry = latest ? "npm" : null;
      if (!latest) {
        latest = await fetchLatestPyPiVersion(dep.name);
        registry = latest ? "pypi" : null;
      }
    }

    if (!latest) continue;

    const cmp = compareSemverish(currentVersion, latest);
    if (cmp !== null && cmp < 0) {
      results.push({
        name: dep.name,
        currentVersion,
        latestVersion: latest,
        registry,
      });
    }
  }

  return results;
}

async function collectCodeFiles(cloneDir, files) {
  const collected = [];

  for (const relativePath of files.slice(0, 500)) {
    const ext = path.extname(relativePath).toLowerCase();
    if (!CODE_EXTENSIONS.has(ext)) continue;

    const filePath = path.join(cloneDir, relativePath);

    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 1024 * 256) continue;
      const content = await fs.readFile(filePath, "utf8");
      collected.push({ path: relativePath, content });
    } catch {
      // Ignore unreadable files
    }
  }

  return collected;
}

function estimateComplexity(content) {
  if (!content) return 1;

  const patterns = [
    /\bif\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?/g,
    /&&/g,
    /\|\|/g,
  ];

  let complexity = 1;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    complexity += matches ? matches.length : 0;
  }

  return complexity;
}

function detectHighComplexity(codeFiles) {
  const threshold = 20;
  const files = codeFiles.map((file) => ({
    path: file.path,
    complexity: estimateComplexity(file.content),
  }));

  const high = files.filter((file) => file.complexity >= threshold);
  const top = [...high].sort((a, b) => b.complexity - a.complexity).slice(0, 10);

  const average = files.length
    ? files.reduce((sum, file) => sum + file.complexity, 0) / files.length
    : 0;

  return {
    files,
    highComplexityFiles: top,
    averageComplexity: Math.round(average * 100) / 100,
  };
}

async function runGitLog(cloneDir, args) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: cloneDir,
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
    });
    return stdout || "";
  } catch {
    return "";
  }
}

function parseGitFileCounts(logOutput) {
  const counts = new Map();

  for (const line of logOutput.split(/\r?\n/)) {
    const file = line.trim();
    if (!file) continue;
    if (file.startsWith("commit ")) continue;
    if (file.includes("=>")) continue;

    counts.set(file, (counts.get(file) || 0) + 1);
  }

  return counts;
}

async function analyzeFileChangeFrequency(cloneDir) {
  const allHistory = await runGitLog(cloneDir, [
    "log",
    "--name-only",
    "--pretty=format:",
    "--no-merges",
  ]);

  const recentHistory = await runGitLog(cloneDir, [
    "log",
    "--since=90.days",
    "--name-only",
    "--pretty=format:",
    "--no-merges",
  ]);

  const allCounts = parseGitFileCounts(allHistory);
  const recentCounts = parseGitFileCounts(recentHistory);

  const hotspots = [...allCounts.entries()]
    .map(([file, commits]) => ({
      file,
      commits,
      recentCommits: recentCounts.get(file) || 0,
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 15);

  const risky = hotspots.filter((item) => item.commits >= 8 || item.recentCommits >= 4);

  return {
    hotspots,
    riskyHotspots: risky,
  };
}

async function readCoverageFromReports(cloneDir) {
  const candidates = [
    "coverage/coverage-summary.json",
    "coverage/coverage-final.json",
    "coverage/lcov.info",
    "coverage.xml",
    "target/site/jacoco/jacoco.xml",
  ];

  for (const relativePath of candidates) {
    const fullPath = path.join(cloneDir, relativePath);

    try {
      const content = await fs.readFile(fullPath, "utf8");

      if (relativePath.endsWith("coverage-summary.json")) {
        const json = JSON.parse(content);
        const pct = json?.total?.lines?.pct;
        if (typeof pct === "number") return pct;
      }

      if (relativePath.endsWith("lcov.info")) {
        const lf = content.match(/LF:(\d+)/);
        const lh = content.match(/LH:(\d+)/);
        if (lf && lh) {
          const total = Number(lf[1]);
          const hit = Number(lh[1]);
          if (total > 0) return (hit / total) * 100;
        }
      }

      if (relativePath.endsWith("coverage.xml")) {
        const lineRate = content.match(/line-rate="([0-9.]+)"/);
        if (lineRate) return Number(lineRate[1]) * 100;
      }

      if (relativePath.endsWith("jacoco.xml")) {
        const m = content.match(/<counter type="LINE" missed="(\d+)" covered="(\d+)"/);
        if (m) {
          const missed = Number(m[1]);
          const covered = Number(m[2]);
          const total = missed + covered;
          if (total > 0) return (covered / total) * 100;
        }
      }
    } catch {
      // Continue searching remaining reports.
    }
  }

  return null;
}

function detectTestFrameworks(dependencies, scanData) {
  const depNames = new Set(dependencies.map((item) => item.name.toLowerCase()));
  const frameworks = [];

  if (depNames.has("jest")) frameworks.push("jest");
  if (depNames.has("mocha")) frameworks.push("mocha");
  if (depNames.has("pytest")) frameworks.push("pytest");
  if (depNames.has("junit") || depNames.has("org.junit.jupiter:junit-jupiter")) frameworks.push("junit");

  if (scanData.lowerFiles.has("pytest.ini") || scanData.files.some((f) => f.startsWith("tests/"))) {
    if (!frameworks.includes("pytest")) frameworks.push("pytest");
  }

  if (scanData.lowerFiles.has("jest.config.js") || scanData.lowerFiles.has("jest.config.ts")) {
    if (!frameworks.includes("jest")) frameworks.push("jest");
  }

  return frameworks;
}

async function detectCoverage({ dependencies, scanData, cloneDir }) {
  const frameworks = detectTestFrameworks(dependencies, scanData);
  const reportCoverage = await readCoverageFromReports(cloneDir);

  if (reportCoverage !== null) {
    return {
      frameworks,
      estimatedCoverage: Math.round(reportCoverage * 100) / 100,
      hasCoverageReport: true,
    };
  }

  // Heuristic when no report exists.
  let estimated = 10;
  if (frameworks.length > 0) estimated = 35;
  if (frameworks.length >= 2) estimated = 45;

  return {
    frameworks,
    estimatedCoverage: estimated,
    hasCoverageReport: false,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreTechnicalDebt({ outdated, complexity, churn, coverage }) {
  const outdatedRisk = clamp(outdated.length * 4, 0, 40);
  const complexityRisk = clamp(complexity.highComplexityFiles.length * 3 + Math.max(0, complexity.averageComplexity - 10) * 0.5, 0, 25);
  const churnRisk = clamp(churn.riskyHotspots.length * 2.5, 0, 20);
  const coverageRisk = clamp((100 - coverage.estimatedCoverage) * 0.15, 0, 15);

  const debtScore = Math.round(clamp(outdatedRisk + complexityRisk + churnRisk + coverageRisk, 0, 100));

  const riskFactors = [];
  const recommendations = [];

  if (outdated.length > 0) {
    riskFactors.push(`outdated dependency risk: ${outdated.length} dependency versions behind latest`);
    recommendations.push("Upgrade outdated dependencies in small batches and run regression checks after each batch.");
  }

  if (complexity.highComplexityFiles.length > 0) {
    riskFactors.push(`high complexity modules detected: ${complexity.highComplexityFiles.length} files above complexity threshold`);
    recommendations.push("Refactor high complexity files by splitting large functions and reducing branching depth.");
  }

  if (churn.riskyHotspots.length > 0) {
    riskFactors.push(`high file churn hotspots: ${churn.riskyHotspots.length} frequently modified files`);
    recommendations.push("Stabilize hotspot files with stronger ownership, modularization, and targeted test coverage.");
  }

  if (coverage.estimatedCoverage < 50) {
    riskFactors.push(`low test coverage estimate: ${Math.round(coverage.estimatedCoverage)}%`);
    recommendations.push("Add automated tests for critical paths and publish machine-readable coverage reports in CI.");
  }

  if (!coverage.hasCoverageReport) {
    recommendations.push("Generate coverage artifacts (lcov, coverage-summary.json, or jacoco.xml) for accurate debt scoring.");
  }

  if (!riskFactors.length) {
    riskFactors.push("no major technical debt hotspots detected by current rules");
  }

  return {
    debtScore,
    riskFactors,
    recommendations,
  };
}

async function ensureAnalysisAndDependencies(repositoryId, userId) {
  let analysis = await RepositoryAnalysis.findOne({ repositoryId });
  let dependencies = await Dependency.find({ repositoryId });

  if (!analysis || !dependencies.length) {
    analysis = await runRepositoryAnalysis({ repositoryId, userId });
    dependencies = await Dependency.find({ repositoryId });
  }

  return { analysis, dependencies };
}

async function runTechnicalDebtScan({ repositoryId, userId }) {
  const { dependencies } = await ensureAnalysisAndDependencies(repositoryId, userId);

  let tempRoot = null;

  try {
    const { repository, tempRoot: tmp, cloneDir } = await cloneRepositoryToTempWorkspace(repositoryId, {
      fullHistory: true,
    });
    tempRoot = tmp;

    const scanData = await scanRepositoryFiles(cloneDir);
    const codeFiles = await collectCodeFiles(cloneDir, scanData.files);

    const [outdatedDependencies, complexity, churn, coverage] = await Promise.all([
      detectOutdatedDependencies(dependencies),
      Promise.resolve(detectHighComplexity(codeFiles)),
      analyzeFileChangeFrequency(cloneDir),
      detectCoverage({ dependencies, scanData, cloneDir }),
    ]);

    const scoreResult = scoreTechnicalDebt({
      outdated: outdatedDependencies,
      complexity,
      churn,
      coverage,
    });

    const report = await TechnicalDebtReport.findOneAndUpdate(
      { repositoryId },
      {
        repositoryId,
        workspaceId: repository.workspaceId,
        debtScore: scoreResult.debtScore,
        riskFactors: scoreResult.riskFactors,
        recommendations: scoreResult.recommendations,
        details: {
          outdatedDependencies: outdatedDependencies.length,
          highComplexityFiles: complexity.highComplexityFiles.length,
          churnHotspots: churn.riskyHotspots.length,
          estimatedCoverage: Math.round(coverage.estimatedCoverage),
        },
        scannedAt: new Date(),
        scannedBy: userId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
      debtScore: report.debtScore,
      riskFactors: report.riskFactors,
      recommendations: report.recommendations,
      details: {
        outdatedDependencies,
        highComplexityFiles: complexity.highComplexityFiles,
        churnHotspots: churn.riskyHotspots,
        estimatedCoverage: coverage.estimatedCoverage,
        detectedTestFrameworks: coverage.frameworks,
        hasCoverageReport: coverage.hasCoverageReport,
      },
    };
  } finally {
    await cleanupTempWorkspace(tempRoot);
  }
}

module.exports = {
  runTechnicalDebtScan,
};
