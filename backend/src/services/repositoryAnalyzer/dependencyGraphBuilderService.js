/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs/promises");
const path = require("path");

const Dependency = require("../../models/Dependency");
const RepositoryAnalysis = require("../../models/RepositoryAnalysis");
const ServiceNode = require("../../models/ServiceNode");
const ServiceEdge = require("../../models/ServiceEdge");
const {
  cloneRepositoryToTempWorkspace,
  cleanupTempWorkspace,
} = require("./repositoryCloneService");
const { scanRepositoryFiles } = require("./fileScannerService");
const { runRepositoryAnalysis } = require("./repositoryAnalyzerService");

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".json",
  ".yml",
  ".yaml",
  ".env",
  ".toml",
  ".xml",
  ".properties",
]);

function normalizeLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadRelevantTextContents(cloneDir, files) {
  const snippets = [];

  const selected = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return TEXT_EXTENSIONS.has(ext) || file.toLowerCase().includes("docker-compose") || file.toLowerCase().startsWith(".env");
  });

  for (const relativePath of selected.slice(0, 250)) {
    const fullPath = path.join(cloneDir, relativePath);

    try {
      const stat = await fs.stat(fullPath);
      if (stat.size > 1024 * 256) continue;
      const content = await fs.readFile(fullPath, "utf8");
      snippets.push({ path: relativePath, content });
    } catch {
      // Ignore unreadable files.
    }
  }

  return snippets;
}

function parseDockerComposeServiceNames(composeRaw) {
  if (!composeRaw) return [];

  const lines = composeRaw.split(/\r?\n/);
  const services = [];
  let inServices = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");

    if (/^services\s*:/i.test(line.trim())) {
      inServices = true;
      continue;
    }

    if (!inServices) continue;

    // Stop scanning services when another top-level section starts.
    if (/^[A-Za-z0-9_-]+\s*:\s*$/.test(line) && !line.startsWith("  ")) {
      break;
    }

    const match = line.match(/^\s{2}([A-Za-z0-9._-]+)\s*:\s*$/);
    if (match) {
      services.push(match[1]);
    }
  }

  return services;
}

function buildInitialNodes(analysis, dependencies, scanData) {
  const nodes = [];
  const byName = new Map();

  const addNode = (name, type) => {
    const key = name.toLowerCase();
    if (byName.has(key)) return;
    const node = { name, type };
    byName.set(key, node);
    nodes.push(node);
  };

  if (analysis.summary?.frontend && analysis.summary.frontend !== "unknown") {
    addNode(analysis.summary.frontend, "frontend");
  }

  if (analysis.summary?.backend && analysis.summary.backend !== "unknown") {
    addNode(analysis.summary.backend, "backend");
  }

  if (analysis.summary?.database && analysis.summary.database !== "unknown") {
    addNode(analysis.summary.database, "database");
  }

  if (analysis.summary?.cache && analysis.summary.cache !== "unknown") {
    addNode(analysis.summary.cache, "cache");
  }

  const depNames = new Set(dependencies.map((dep) => dep.name.toLowerCase()));

  if (
    depNames.has("kong") ||
    depNames.has("express-gateway") ||
    depNames.has("@aws-sdk/client-apigateway") ||
    depNames.has("aws-apigateway-importer")
  ) {
    addNode("API Gateway", "gateway");
  }

  if (
    depNames.has("@auth0/nextjs-auth0") ||
    depNames.has("jsonwebtoken") ||
    depNames.has("passport") ||
    depNames.has("next-auth") ||
    depNames.has("spring-security-oauth2-client")
  ) {
    addNode("Auth Service", "auth");
  }

  const composeServices = parseDockerComposeServiceNames(scanData.dockerComposeRaw || "");
  for (const serviceName of composeServices) {
    const normalized = serviceName.toLowerCase();

    if (normalized.includes("postgres") && !byName.has("postgresql")) {
      addNode("PostgreSQL", "database");
      continue;
    }

    if (normalized.includes("redis") && !byName.has("redis")) {
      addNode("Redis", "cache");
      continue;
    }

    if (normalized.includes("auth") && !byName.has("auth service")) {
      addNode("Auth Service", "auth");
      continue;
    }

    if (normalized.includes("api") && !byName.has("api gateway")) {
      addNode("API Gateway", "gateway");
      continue;
    }

    addNode(normalizeLabel(serviceName), "service");
  }

  return nodes;
}

function detectSignals(contents) {
  const signals = {
    apiCallsDetected: false,
    authServiceUrlDetected: false,
    apiGatewayUrlDetected: false,
    dbConfigDetected: false,
    cacheConfigDetected: false,
    referencedInternalServices: new Set(),
  };

  for (const file of contents) {
    const content = file.content || "";

    if (/fetch\(|axios\.|http\.request\(|requests\.|RestTemplate|WebClient/i.test(content)) {
      signals.apiCallsDetected = true;
    }

    if (/AUTH(_SERVICE)?_URL|AUTH0|OAUTH|JWT/i.test(content)) {
      signals.authServiceUrlDetected = true;
    }

    if (/API_GATEWAY|GATEWAY_URL|\/api\/|APIGW/i.test(content)) {
      signals.apiGatewayUrlDetected = true;
    }

    if (/DATABASE_URL|MONGO_URI|POSTGRES|MYSQL|JDBC:/i.test(content)) {
      signals.dbConfigDetected = true;
    }

    if (/REDIS_URL|IOREDIS|CACHE_URL|MEMCACHED/i.test(content)) {
      signals.cacheConfigDetected = true;
    }

    const urlPattern = /https?:\/\/([a-zA-Z0-9._-]+)(?::\d+)?/g;
    let match;
    while ((match = urlPattern.exec(content)) !== null) {
      const host = match[1].toLowerCase();
      if (
        !["localhost", "127.0.0.1"].includes(host) &&
        !host.endsWith(".com") &&
        !host.endsWith(".io")
      ) {
        signals.referencedInternalServices.add(host);
      }
    }
  }

  return signals;
}

function getNode(nodes, predicate) {
  return nodes.find(predicate) || null;
}

function buildEdges(nodes, signals) {
  const edges = [];
  const edgeSet = new Set();

  const addEdge = (source, target, relationship) => {
    if (!source || !target || source.name === target.name) return;
    const key = `${source.name}::${target.name}::${relationship}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ source: source.name, target: target.name, relationship });
  };

  const frontend = getNode(nodes, (node) => node.type === "frontend");
  const gateway = getNode(nodes, (node) => node.type === "gateway");
  const auth = getNode(nodes, (node) => node.type === "auth");
  const backend = getNode(nodes, (node) => node.type === "backend" || node.type === "service");
  const database = getNode(nodes, (node) => node.type === "database");
  const cache = getNode(nodes, (node) => node.type === "cache");

  if (frontend && gateway) addEdge(frontend, gateway, "routes_through");
  if (frontend && !gateway && backend) addEdge(frontend, backend, "api_call");
  if (gateway && auth) addEdge(gateway, auth, "auth_check");
  if (auth && backend) addEdge(auth, backend, "token_validation");
  if (gateway && backend) addEdge(gateway, backend, "forwards_to");
  if (backend && database) addEdge(backend, database, "database_config");
  if (backend && cache) addEdge(backend, cache, "cache_config");

  if (signals.apiCallsDetected && frontend && backend) {
    addEdge(frontend, backend, "api_call");
  }

  if (signals.authServiceUrlDetected && backend && auth) {
    addEdge(backend, auth, "service_url");
  }

  if (signals.apiGatewayUrlDetected && frontend && gateway) {
    addEdge(frontend, gateway, "service_url");
  }

  if (signals.dbConfigDetected && backend && database) {
    addEdge(backend, database, "env_config");
  }

  if (signals.cacheConfigDetected && backend && cache) {
    addEdge(backend, cache, "env_config");
  }

  for (const host of signals.referencedInternalServices) {
    const normalized = normalizeLabel(host.split(".")[0]);
    const target = getNode(nodes, (node) => node.name.toLowerCase() === normalized.toLowerCase());
    if (backend && target) {
      addEdge(backend, target, "service_url");
    }
  }

  return edges;
}

async function persistGraph(repositoryId, nodes, edges) {
  await ServiceNode.deleteMany({ repositoryId });
  await ServiceEdge.deleteMany({ repositoryId });

  const createdNodes = nodes.length
    ? await ServiceNode.insertMany(
        nodes.map((node) => ({
          repositoryId,
          name: node.name,
          type: node.type,
        }))
      )
    : [];

  const createdEdges = edges.length
    ? await ServiceEdge.insertMany(
        edges.map((edge) => ({
          repositoryId,
          source: edge.source,
          target: edge.target,
          relationship: edge.relationship,
        }))
      )
    : [];

  return {
    nodes: createdNodes,
    edges: createdEdges,
  };
}

async function generateDependencyGraph({ repositoryId, userId }) {
  let analysis = await RepositoryAnalysis.findOne({ repositoryId });
  if (!analysis) {
    analysis = await runRepositoryAnalysis({ repositoryId, userId });
  }

  const dependencies = await Dependency.find({ repositoryId });

  let tempRoot = null;

  try {
    const { tempRoot: tmp, cloneDir } = await cloneRepositoryToTempWorkspace(repositoryId);
    tempRoot = tmp;

    const scanData = await scanRepositoryFiles(cloneDir);
    const contentSamples = await loadRelevantTextContents(cloneDir, scanData.files);
    const signals = detectSignals(contentSamples);

    const nodes = buildInitialNodes(analysis, dependencies, scanData);
    const edges = buildEdges(nodes, signals);

    const graph = await persistGraph(repositoryId, nodes, edges);

    return {
      nodes: graph.nodes,
      edges: graph.edges,
    };
  } finally {
    await cleanupTempWorkspace(tempRoot);
  }
}

module.exports = {
  generateDependencyGraph,
};
