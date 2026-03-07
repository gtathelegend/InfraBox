import type { Express } from "express";
import type { Server } from "http";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "./db";
import { enqueueAnalysis, initAnalysisQueue } from "./analysisQueue";
import {
  analysisJobs,
  codeAnalysisResults,
  createInfrastructureRequestSchema,
  incidents,
  infrastructureCompatibilityResults,
  infrastructureConfigs,
  pipelines,
  preventiveSuggestions,
  repositories,
  trafficSimulationResults,
  users,
  workspaces,
} from "@shared/schema";

type RequestIdentity = {
  auth0Id: string;
  email: string;
  name: string;
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length < 2) return null;

  try {
    const middle = segments[1] ?? "";
    const normalized = middle.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

function extractGithubTokenFromAuthPayload(payload: Record<string, unknown> | null): string {
  if (!payload) return "";

  const candidates = [
    payload["https://infrabox.ai/github_access_token"],
    payload["https://infrabox.dev/github_access_token"],
    payload["github_access_token"],
  ];

  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }
  }

  const identities = payload["identities"];
  if (Array.isArray(identities)) {
    for (const identity of identities) {
      if (identity && typeof identity === "object") {
        const accessToken = (identity as Record<string, unknown>)["access_token"];
        if (typeof accessToken === "string" && accessToken.trim()) {
          return accessToken.trim();
        }
      }
    }
  }

  return "";
}

function getGithubTokenFromRequest(req: any): string {
  const explicitHeader =
    (typeof req.headers["x-github-token"] === "string" && req.headers["x-github-token"].trim()) ||
    "";
  if (explicitHeader) return explicitHeader;

  const authHeader = typeof req.headers["authorization"] === "string" ? req.headers["authorization"] : "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const idToken = typeof req.headers["x-auth-token"] === "string" ? req.headers["x-auth-token"].trim() : "";

  // Allow direct PAT style token pass-through.
  if (bearer.startsWith("ghp_") || bearer.startsWith("github_pat_")) {
    return bearer;
  }

  const fromBearerClaims = extractGithubTokenFromAuthPayload(decodeJwtPayload(bearer));
  if (fromBearerClaims) return fromBearerClaims;

  const fromIdTokenClaims = extractGithubTokenFromAuthPayload(decodeJwtPayload(idToken));
  if (fromIdTokenClaims) return fromIdTokenClaims;

  return process.env.GITHUB_TOKEN || "";
}

function toRepoDisplayName(repoName: string): string {
  if (repoName.includes("/")) return repoName;
  return `workspace/${repoName}`;
}

function getIdentity(req: any): RequestIdentity | null {
  const fromQueryAuth0Id = typeof req.query.auth0Id === "string" ? req.query.auth0Id : null;
  const fromQueryEmail = typeof req.query.email === "string" ? req.query.email : null;
  const fromHeadersAuth0Id = req.headers["x-auth0-id"];
  const fromHeadersEmail = req.headers["x-user-email"];

  const auth0Id = fromQueryAuth0Id || (typeof fromHeadersAuth0Id === "string" ? fromHeadersAuth0Id : "");
  const email = fromQueryEmail || (typeof fromHeadersEmail === "string" ? fromHeadersEmail : "");

  if (!auth0Id || !email) {
    const authHeader = typeof req.headers["authorization"] === "string" ? req.headers["authorization"] : "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const idToken = typeof req.headers["x-auth-token"] === "string" ? req.headers["x-auth-token"].trim() : "";

    const payload = decodeJwtPayload(idToken) ?? decodeJwtPayload(bearer);
    const sub = typeof payload?.sub === "string" ? payload.sub : "";
    const tokenEmail = typeof payload?.email === "string" ? payload.email : "";

    if (sub && tokenEmail) {
      const namePart = tokenEmail.split("@")[0] || "User";
      return {
        auth0Id: sub,
        email: tokenEmail,
        name: namePart,
      };
    }
  }

  if (!auth0Id || !email) return null;

  const namePart = email.split("@")[0] || "User";
  return {
    auth0Id,
    email,
    name: namePart,
  };
}

async function getOrCreateUserAndWorkspace(identity: RequestIdentity) {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.auth0Id, identity.auth0Id))
    .limit(1);

  if (existingUser) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, Number(existingUser.workspaceId)))
      .limit(1);

    if (workspace) {
      return { user: existingUser, workspace, role: existingUser.role };
    }
  }

  const [newUser] = await db
    .insert(users)
    .values({
      auth0Id: identity.auth0Id,
      email: identity.email,
      name: identity.name,
      role: "Owner",
    })
    .returning();

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: `${identity.name}'s Workspace`,
      ownerId: newUser.id,
    })
    .returning();

  const [updatedUser] = await db
    .update(users)
    .set({ workspaceId: workspace.id, role: "Owner" })
    .where(eq(users.id, newUser.id))
    .returning();

  return { user: updatedUser, workspace, role: "Owner" };
}

async function ensureUsersAuth0Column() {
  // Some local SQLite files were created before auth0_id was introduced.
  try {
    await db.run(sql.raw("ALTER TABLE users ADD COLUMN auth0_id text"));
  } catch {
    // Column already exists or backend doesn't support this operation.
  }

  try {
    await db.run(sql.raw("ALTER TABLE users ADD COLUMN workspace_id integer"));
  } catch {
    // Column already exists or not needed.
  }

  try {
    await db.run(sql.raw("ALTER TABLE users ADD COLUMN role text DEFAULT 'Owner'"));
  } catch {
    // Column already exists or not needed.
  }

  try {
    await db.run(sql.raw("ALTER TABLE users ADD COLUMN name text"));
  } catch {
    // Column already exists or not needed.
  }

  try {
    await db.run(sql.raw("ALTER TABLE users ADD COLUMN created_at text"));
  } catch {
    // Column already exists or not needed.
  }

  try {
    await db.run(sql.raw("UPDATE users SET created_at = COALESCE(created_at, datetime('now'))"));
  } catch {
    // Best-effort backfill only.
  }

  try {
    await db.run(sql.raw("UPDATE users SET auth0_id = COALESCE(auth0_id, 'legacy-' || id) WHERE auth0_id IS NULL OR auth0_id = ''"));
  } catch {
    // Best-effort backfill only.
  }

  try {
    await db.run(sql.raw("CREATE UNIQUE INDEX IF NOT EXISTS users_auth0_id_unique ON users(auth0_id)"));
  } catch {
    // Index creation is optional for local compatibility.
  }
}

async function ensureWorkspacesColumns() {
  try {
    await db.run(sql.raw("ALTER TABLE workspaces ADD COLUMN owner_id integer"));
  } catch {
    // Column already exists or table not present.
  }

  try {
    await db.run(sql.raw("ALTER TABLE workspaces ADD COLUMN created_at text"));
  } catch {
    // Column already exists or table not present.
  }

  try {
    await db.run(sql.raw("UPDATE workspaces SET created_at = COALESCE(created_at, datetime('now'))"));
  } catch {
    // Best-effort backfill only.
  }
}

async function ensureRepositoriesColumns() {
  const migrationStatements = [
    "ALTER TABLE repositories ADD COLUMN workspace_id integer",
    "ALTER TABLE repositories ADD COLUMN external_repo_id text",
    "ALTER TABLE repositories ADD COLUMN provider text",
    "ALTER TABLE repositories ADD COLUMN url text",
    "ALTER TABLE repositories ADD COLUMN status text",
    "ALTER TABLE repositories ADD COLUMN default_branch text",
    "ALTER TABLE repositories ADD COLUMN last_analyzed text",
    "ALTER TABLE repositories ADD COLUMN created_at text",
  ];

  for (const statement of migrationStatements) {
    try {
      await db.run(sql.raw(statement));
    } catch {
      // Best-effort compatibility for existing local DB files.
    }
  }

  try {
    await db.run(sql.raw("UPDATE repositories SET provider = COALESCE(provider, 'github')"));
  } catch {
    // Best-effort backfill only.
  }

  try {
    await db.run(sql.raw("UPDATE repositories SET status = COALESCE(status, 'connected')"));
  } catch {
    // Best-effort backfill only.
  }

  try {
    await db.run(sql.raw("UPDATE repositories SET created_at = COALESCE(created_at, datetime('now'))"));
  } catch {
    // Best-effort backfill only.
  }
}

async function ensureCoreTables() {
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS infrastructure_configs (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      workspace_id integer NOT NULL,
      repo_id integer NOT NULL,
      provider text NOT NULL,
      cpu integer NOT NULL,
      memory_gb integer NOT NULL,
      storage_gb integer NOT NULL,
      autoscaling integer NOT NULL DEFAULT 0,
      region text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS code_analysis_results (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      workspace_id integer NOT NULL,
      repo_id integer NOT NULL,
      infrastructure_config_id integer,
      framework text,
      backend text,
      language text,
      services_json text,
      dependencies_json text,
      database text,
      cache text,
      estimated_memory_gb integer,
      estimated_cpu_cores integer,
      pipeline_stages_json text,
      pipeline_graph_json text,
      service_dependency_graph_json text,
      raw_json text,
      created_at text DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS traffic_simulation_results (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      workspace_id integer NOT NULL,
      repo_id integer NOT NULL,
      analysis_id integer NOT NULL,
      scenarios_json text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS infrastructure_compatibility_results (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      workspace_id integer NOT NULL,
      repo_id integer NOT NULL,
      analysis_id integer NOT NULL,
      infrastructure_config_id integer NOT NULL,
      server_memory_gb integer NOT NULL,
      predicted_memory_gb integer NOT NULL,
      server_cpu_cores integer NOT NULL,
      predicted_cpu_cores integer NOT NULL,
      result text NOT NULL,
      risks_json text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS preventive_suggestions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      workspace_id integer NOT NULL,
      repo_id integer NOT NULL,
      analysis_id integer NOT NULL,
      issue text NOT NULL,
      solution text NOT NULL,
      code_location text,
      created_at text DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS analysis_jobs (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      workspace_id integer NOT NULL,
      repo_id integer NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      analysis_id integer,
      error text,
      created_at text DEFAULT CURRENT_TIMESTAMP,
      updated_at text DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const statement of createStatements) {
    try {
      await db.run(sql.raw(statement));
    } catch {
      // Keep startup resilient for mixed local schemas.
    }
  }
}

async function fetchGithubRepos(token: string) {
  const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Infrabox",
    },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as Array<{
    id: number;
    full_name: string;
    html_url: string;
    default_branch: string;
    private: boolean;
  }>;

  return data.map((repo) => ({
    externalRepoId: String(repo.id),
    name: repo.full_name,
    url: repo.html_url,
    defaultBranch: repo.default_branch ?? "main",
    private: repo.private,
  }));
}

async function fetchGithubReposByUsername(username: string) {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Infrabox",
      },
    },
  );

  if (!response.ok) return [];

  const data = (await response.json()) as Array<{
    id: number;
    full_name: string;
    html_url: string;
    default_branch: string;
    private: boolean;
  }>;

  return data.map((repo) => ({
    externalRepoId: String(repo.id),
    name: repo.full_name,
    url: repo.html_url,
    defaultBranch: repo.default_branch ?? "main",
    private: repo.private,
  }));
}

async function fetchGithubBranches(token: string, fullName: string) {
  const response = await fetch(`https://api.github.com/repos/${fullName}/branches`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Infrabox",
    },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as Array<{ name: string }>;
  return data.map((branch) => branch.name);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await initAnalysisQueue();
  await ensureCoreTables();
  await ensureUsersAuth0Column();
  await ensureWorkspacesColumns();
  await ensureRepositoriesColumns();

  app.get("/api/auth/github/login", async (_req, res) => {
    const domain = process.env.AUTH0_DOMAIN || process.env.VITE_AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID || process.env.VITE_AUTH0_CLIENT_ID;
    const audience = process.env.AUTH0_AUDIENCE || process.env.VITE_AUTH0_AUDIENCE;
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

    if (!domain || !clientId) {
      return res.redirect(
        "/auth?error=auth0_not_configured&error_description=Missing AUTH0_DOMAIN or AUTH0_CLIENT_ID",
      );
    }

    const redirectUri = `${appBaseUrl}/api/auth/callback`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid profile email",
      connection: "github",
    });

    if (audience) {
      params.set("audience", audience);
    }

    return res.redirect(`https://${domain}/authorize?${params.toString()}`);
  });

  app.get("/api/auth/callback", async (req, res) => {
    const authError = typeof req.query.error === "string" ? req.query.error : "";
    const authErrorDescription =
      typeof req.query.error_description === "string" ? req.query.error_description : "";

    if (authError) {
      const query = new URLSearchParams({
        error: authError,
        error_description: authErrorDescription || "Authentication failed",
      });
      return res.redirect(`/auth?${query.toString()}`);
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      return res.redirect("/auth?error=missing_code&error_description=Missing+authorization+code");
    }

    const domain = process.env.AUTH0_DOMAIN || process.env.VITE_AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID || process.env.VITE_AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET || "";
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
    const redirectUri = `${appBaseUrl}/api/auth/callback`;

    if (!domain || !clientId || !clientSecret) {
      return res.redirect(
        "/auth?error=auth0_not_configured&error_description=Missing+AUTH0+server+credentials",
      );
    }

    const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenJson = (await tokenResponse.json()) as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || !tokenJson.id_token) {
      const query = new URLSearchParams({
        error: tokenJson.error || "token_exchange_failed",
        error_description: tokenJson.error_description || "Failed to exchange authorization code",
      });
      return res.redirect(`/auth?${query.toString()}`);
    }

    const claims = decodeJwtPayload(tokenJson.id_token);
    const auth0Id = typeof claims?.sub === "string" ? claims.sub : "";
    const email =
      typeof claims?.email === "string"
        ? claims.email
        : auth0Id
          ? `${auth0Id.replace(/[^a-zA-Z0-9]/g, "_")}@users.infrabox.local`
          : "";

    if (!auth0Id || !email) {
      return res.redirect(
        "/auth?error=profile_read_failed&error_description=Unable+to+resolve+Auth0+identity",
      );
    }

    const query = new URLSearchParams({
      auth0Id,
      email,
    });
    return res.redirect(`/auth?${query.toString()}`);
  });

  app.get("/api/me", async (req, res) => {
    const identity = getIdentity(req);
    if (!identity) {
      return res.status(401).json({
        message: "Auth0 identity required. Provide auth0Id and email.",
      });
    }

    const me = await getOrCreateUserAndWorkspace(identity);
    return res.json(me);
  });

  app.get("/api/git/repos", async (req, res) => {
    const workspaceId = parseNumber(req.query.workspaceId);
    const token = getGithubTokenFromRequest(req);
    const githubUser = typeof req.query.githubUser === "string" ? req.query.githubUser.trim() : "";

    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId is required" });
    }

    let remoteRepos: Array<{
      externalRepoId: string;
      name: string;
      url: string;
      defaultBranch: string;
      private: boolean;
    }> = [];

    if (token) {
      remoteRepos = await fetchGithubRepos(token);
    } else if (githubUser) {
      remoteRepos = await fetchGithubReposByUsername(githubUser);
    }

    if (remoteRepos.length === 0) {
      const stored = await db
        .select()
        .from(repositories)
        .where(eq(repositories.workspaceId, workspaceId));

      return res.json(stored);
    }

    const existing = await db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, workspaceId));

    const existingByExternalId = new Map(existing.map((repo) => [repo.externalRepoId, repo]));

    for (const repo of remoteRepos) {
      if (existingByExternalId.has(repo.externalRepoId)) continue;

      await db.insert(repositories).values({
        workspaceId,
        externalRepoId: repo.externalRepoId,
        name: repo.name,
        provider: "github",
        url: repo.url,
        status: "connected",
        defaultBranch: repo.defaultBranch,
      });
    }

    const latest = await db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, workspaceId));

    return res.json(latest);
  });

  app.get("/api/git/repos/:repoId/branches", async (req, res) => {
    const repoId = parseNumber(req.params.repoId);
    if (!repoId) {
      return res.status(400).json({ message: "repoId is required" });
    }

    const [repo] = await db.select().from(repositories).where(eq(repositories.id, repoId)).limit(1);
    if (!repo) {
      return res.status(404).json({ message: "Repository not found" });
    }

    const token = getGithubTokenFromRequest(req);

    if (!token || repo.provider !== "github") {
      return res.json({ branches: [repo.defaultBranch ?? "main"] });
    }

    const branches = await fetchGithubBranches(token, repo.name);
    return res.json({ branches: branches.length ? branches : [repo.defaultBranch ?? "main"] });
  });

  app.get("/api/git/repos/:repoId/pipelines", async (req, res) => {
    const repoId = parseNumber(req.params.repoId);
    if (!repoId) {
      return res.status(400).json({ message: "repoId is required" });
    }

    const [analysis] = await db
      .select()
      .from(codeAnalysisResults)
      .where(eq(codeAnalysisResults.repoId, repoId))
      .orderBy(desc(codeAnalysisResults.id))
      .limit(1);

    const stages = parseJsonArray<string>(analysis?.pipelineStagesJson) || [];
    return res.json({ stages });
  });

  app.post("/api/infrastructure/config", async (req, res) => {
    const payload = createInfrastructureRequestSchema.parse(req.body);

    const [config] = await db.insert(infrastructureConfigs).values(payload).returning();
    return res.status(201).json({ configId: config.id, workspaceId: payload.workspaceId, repoId: payload.repoId });
  });

  app.post("/api/analysis/run", async (req, res) => {
    const body = z
      .object({
        workspaceId: z.coerce.number().int().positive(),
        repoId: z.coerce.number().int().positive(),
      })
      .parse(req.body);

    const [job] = await db
      .insert(analysisJobs)
      .values({
        workspaceId: body.workspaceId,
        repoId: body.repoId,
        status: "queued",
        updatedAt: new Date().toISOString(),
      })
      .returning();

    await enqueueAnalysis({
      jobId: job.id,
      workspaceId: body.workspaceId,
      repoId: body.repoId,
    });

    return res.status(202).json({ jobId: job.id, status: job.status });
  });

  app.get("/api/analysis/jobs/:jobId", async (req, res) => {
    const jobId = parseNumber(req.params.jobId);
    if (!jobId) {
      return res.status(400).json({ message: "jobId is required" });
    }

    const [job] = await db.select().from(analysisJobs).where(eq(analysisJobs.id, jobId)).limit(1);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.json({
      jobId: job.id,
      status: job.status,
      analysisId: job.analysisId,
      error: job.error,
    });
  });

  app.get("/api/analysis", async (req, res) => {
    const workspaceId = parseNumber(req.query.workspaceId);
    const repoId = parseNumber(req.query.repoId);
    const analysisId = parseNumber(req.query.analysisId);

    if (!workspaceId || !repoId) {
      return res.status(400).json({ message: "workspaceId and repoId are required" });
    }

    const whereClause = analysisId
      ? and(
          eq(codeAnalysisResults.workspaceId, workspaceId),
          eq(codeAnalysisResults.repoId, repoId),
          eq(codeAnalysisResults.id, analysisId),
        )
      : and(eq(codeAnalysisResults.workspaceId, workspaceId), eq(codeAnalysisResults.repoId, repoId));

    const [analysis] = await db
      .select()
      .from(codeAnalysisResults)
      .where(whereClause)
      .orderBy(desc(codeAnalysisResults.id))
      .limit(1);

    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    const [simulation] = await db
      .select()
      .from(trafficSimulationResults)
      .where(
        and(
          eq(trafficSimulationResults.workspaceId, workspaceId),
          eq(trafficSimulationResults.repoId, repoId),
          eq(trafficSimulationResults.analysisId, analysis.id),
        ),
      )
      .orderBy(desc(trafficSimulationResults.id))
      .limit(1);

    const [compatibility] = await db
      .select()
      .from(infrastructureCompatibilityResults)
      .where(
        and(
          eq(infrastructureCompatibilityResults.workspaceId, workspaceId),
          eq(infrastructureCompatibilityResults.repoId, repoId),
          eq(infrastructureCompatibilityResults.analysisId, analysis.id),
        ),
      )
      .orderBy(desc(infrastructureCompatibilityResults.id))
      .limit(1);

    const suggestions = await db
      .select()
      .from(preventiveSuggestions)
      .where(
        and(
          eq(preventiveSuggestions.workspaceId, workspaceId),
          eq(preventiveSuggestions.repoId, repoId),
          eq(preventiveSuggestions.analysisId, analysis.id),
        ),
      )
      .orderBy(desc(preventiveSuggestions.id));

    return res.json({
      analysisId: analysis.id,
      framework: analysis.framework,
      backend: analysis.backend,
      language: analysis.language,
      services: parseJsonArray<string>(analysis.servicesJson),
      dependencies: parseJsonArray<string>(analysis.dependenciesJson),
      database: analysis.database,
      cache: analysis.cache,
      estimatedMemoryGb: analysis.estimatedMemoryGb,
      estimatedCpuCores: analysis.estimatedCpuCores,
      pipeline: parseJsonArray<string>(analysis.pipelineStagesJson),
      pipelineGraph: parseJsonObject<{ nodes: string[]; edges: [string, string][] }>(analysis.pipelineGraphJson),
      serviceDependencyGraph: parseJsonObject<{ nodes: string[]; edges: [string, string][] }>(
        analysis.serviceDependencyGraphJson,
      ),
      trafficScenarios: parseJsonArray<{
        users: number;
        cpuUsage: string;
        memoryUsage: string;
        latency: string;
        failureProbability: string;
        risk?: string;
      }>(simulation?.scenariosJson),
      infrastructureCompatibility: compatibility
        ? {
            result: compatibility.result,
            serverMemoryGb: compatibility.serverMemoryGb,
            predictedMemoryGb: compatibility.predictedMemoryGb,
            serverCpuCores: compatibility.serverCpuCores,
            predictedCpuCores: compatibility.predictedCpuCores,
            risks: parseJsonArray<string>(compatibility.risksJson),
          }
        : null,
      suggestions: suggestions.map((item) => ({
        issue: item.issue,
        solution: item.solution,
        codeLocation: item.codeLocation,
      })),
      deploymentConfidence: compatibility?.result === "COMPATIBLE" ? 92 : 63,
    });
  });

  app.post("/api/infrastructure/compatibility", async (req, res) => {
    const payload = z
      .object({
        workspaceId: z.coerce.number().int().positive(),
        repoId: z.coerce.number().int().positive(),
        analysisId: z.coerce.number().int().positive(),
      })
      .parse(req.body);

    const [compatibility] = await db
      .select()
      .from(infrastructureCompatibilityResults)
      .where(
        and(
          eq(infrastructureCompatibilityResults.workspaceId, payload.workspaceId),
          eq(infrastructureCompatibilityResults.repoId, payload.repoId),
          eq(infrastructureCompatibilityResults.analysisId, payload.analysisId),
        ),
      )
      .orderBy(desc(infrastructureCompatibilityResults.id))
      .limit(1);

    if (!compatibility) {
      return res.status(404).json({ message: "Compatibility result not found" });
    }

    return res.json({
      result: compatibility.result,
      serverMemoryGb: compatibility.serverMemoryGb,
      predictedMemoryGb: compatibility.predictedMemoryGb,
      serverCpuCores: compatibility.serverCpuCores,
      predictedCpuCores: compatibility.predictedCpuCores,
      risks: parseJsonArray<string>(compatibility.risksJson),
    });
  });

  app.get("/api/dashboard/result", async (req, res) => {
    const workspaceId = parseNumber(req.query.workspaceId);
    const repoId = parseNumber(req.query.repoId);

    if (!workspaceId || !repoId) {
      return res.status(400).json({ message: "workspaceId and repoId are required" });
    }

    const [repo] = await db
      .select()
      .from(repositories)
      .where(and(eq(repositories.id, repoId), eq(repositories.workspaceId, workspaceId)))
      .limit(1);

    if (!repo) {
      return res.status(404).json({ message: "Repository not found" });
    }

    const [analysis] = await db
      .select()
      .from(codeAnalysisResults)
      .where(and(eq(codeAnalysisResults.workspaceId, workspaceId), eq(codeAnalysisResults.repoId, repoId)))
      .orderBy(desc(codeAnalysisResults.id))
      .limit(1);

    if (!analysis) {
      return res.json({
        workspaceId,
        repoId,
        analysisId: null,
        deploymentConfidence: 0,
        pipelineGraph: { nodes: [], edges: [] },
        trafficSimulation: [],
        infrastructureCompatibility: null,
        suggestions: [],
        codebaseOverview: {
          framework: "Unknown",
          backend: "Unknown",
          language: "Unknown",
          services: [],
          dependencies: [],
          database: "Unknown",
          cache: "Unknown",
        },
        usage: {
          estimatedCpuCores: null,
          estimatedMemoryGb: null,
        },
      });
    }

    const [simulation] = await db
      .select()
      .from(trafficSimulationResults)
      .where(
        and(
          eq(trafficSimulationResults.workspaceId, workspaceId),
          eq(trafficSimulationResults.repoId, repoId),
          eq(trafficSimulationResults.analysisId, analysis.id),
        ),
      )
      .orderBy(desc(trafficSimulationResults.id))
      .limit(1);

    const [compatibility] = await db
      .select()
      .from(infrastructureCompatibilityResults)
      .where(
        and(
          eq(infrastructureCompatibilityResults.workspaceId, workspaceId),
          eq(infrastructureCompatibilityResults.repoId, repoId),
          eq(infrastructureCompatibilityResults.analysisId, analysis.id),
        ),
      )
      .orderBy(desc(infrastructureCompatibilityResults.id))
      .limit(1);

    const suggestions = await db
      .select()
      .from(preventiveSuggestions)
      .where(
        and(
          eq(preventiveSuggestions.workspaceId, workspaceId),
          eq(preventiveSuggestions.repoId, repoId),
          eq(preventiveSuggestions.analysisId, analysis.id),
        ),
      )
      .orderBy(desc(preventiveSuggestions.id));

    const graph = parseJsonObject<{ nodes: string[]; edges: [string, string][] }>(analysis.pipelineGraphJson);
    const trafficScenarios = parseJsonArray<{
      users: number;
      cpuUsage: string;
      memoryUsage: string;
      latency: string;
      failureProbability: string;
      risk?: string;
    }>(simulation?.scenariosJson);

    return res.json({
      workspaceId,
      repoId,
      repository: {
        id: repo.id,
        name: toRepoDisplayName(repo.name),
        provider: repo.provider,
      },
      codebaseOverview: {
        framework: analysis.framework,
        backend: analysis.backend,
        language: analysis.language,
        services: parseJsonArray<string>(analysis.servicesJson),
        dependencies: parseJsonArray<string>(analysis.dependenciesJson),
        database: analysis.database,
        cache: analysis.cache,
      },
      pipelineGraph: {
        nodes: (graph?.nodes ?? []).map((node) => ({ id: node })),
        edges: (graph?.edges ?? []).map(([source, target]) => ({ source, target })),
      },
      trafficSimulation: trafficScenarios,
      usage: {
        estimatedCpuCores: analysis.estimatedCpuCores,
        estimatedMemoryGb: analysis.estimatedMemoryGb,
      },
      infrastructureCompatibility: compatibility
        ? {
            result: compatibility.result,
            serverMemoryGb: compatibility.serverMemoryGb,
            predictedMemoryGb: compatibility.predictedMemoryGb,
            serverCpuCores: compatibility.serverCpuCores,
            predictedCpuCores: compatibility.predictedCpuCores,
            risks: parseJsonArray<string>(compatibility.risksJson),
          }
        : null,
      deploymentConfidence: compatibility?.result === "COMPATIBLE" ? 92 : 63,
      suggestions: suggestions.map((item) => ({
        issue: item.issue,
        solution: item.solution,
        codeLocation: item.codeLocation,
      })),
    });
  });

  // Compatibility for existing pages/services.
  app.get("/api/repositories", async (req, res) => {
    const workspaceId = parseNumber(req.query.workspaceId);
    if (!workspaceId) return res.json([]);

    const repoRows = await db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, workspaceId));

    return res.json(repoRows);
  });

  app.get("/api/repos", async (req, res) => {
    const workspaceId = parseNumber(req.query.workspaceId);
    if (!workspaceId) return res.json([]);

    const repoRows = await db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, workspaceId));

    return res.json(repoRows);
  });

  app.get("/api/pipeline/:repoId", async (req, res) => {
    const repoId = parseNumber(req.params.repoId);
    if (!repoId) return res.status(400).json({ message: "repoId is required" });

    const [analysis] = await db
      .select()
      .from(codeAnalysisResults)
      .where(eq(codeAnalysisResults.repoId, repoId))
      .orderBy(desc(codeAnalysisResults.id))
      .limit(1);

    const graph = parseJsonObject<{ nodes: string[]; edges: [string, string][] }>(analysis?.pipelineGraphJson);
    return res.json({
      nodes: (graph?.nodes ?? []).map((node) => ({ id: node })),
      edges: (graph?.edges ?? []).map(([source, target]) => ({ source, target })),
    });
  });

  app.get("/api/pipelines", async (req, res) => {
    const repoId = parseNumber(req.query.repoId);
    const workspaceId = parseNumber(req.query.workspaceId);

    if (repoId) {
      const rows = await db
        .select()
        .from(pipelines)
        .where(eq(pipelines.repositoryId, repoId))
        .orderBy(desc(pipelines.id));
      return res.json(rows);
    }

    if (workspaceId) {
      const repoRows = await db
        .select({ id: repositories.id })
        .from(repositories)
        .where(eq(repositories.workspaceId, workspaceId));

      const ids = new Set(repoRows.map((row) => row.id));
      const all = await db.select().from(pipelines).orderBy(desc(pipelines.id));
      return res.json(all.filter((row) => ids.has(row.repositoryId)));
    }

    return res.json([]);
  });

  app.get("/api/pipelines/:id", async (req, res) => {
    const id = parseNumber(req.params.id);
    if (!id) return res.status(400).json({ message: "id is required" });

    const [row] = await db.select().from(pipelines).where(eq(pipelines.id, id)).limit(1);
    if (!row) return res.status(404).json({ message: "Not found" });

    return res.json(row);
  });

  app.get("/api/incidents", async (req, res) => {
    const workspaceId = parseNumber(req.query.workspaceId);
    if (!workspaceId) return res.json([]);

    const rows = await db
      .select()
      .from(incidents)
      .where(eq(incidents.workspaceId, workspaceId))
      .orderBy(desc(incidents.id));

    return res.json(rows);
  });

  app.post("/api/incidents/:id/resolve", async (req, res) => {
    const id = parseNumber(req.params.id);
    if (!id) return res.status(400).json({ message: "id is required" });

    const [row] = await db
      .update(incidents)
      .set({ status: "resolved" })
      .where(eq(incidents.id, id))
      .returning();

    if (!row) return res.status(404).json({ message: "Not found" });
    return res.json(row);
  });

  app.get("/api/simulation", async (req, res) => {
    const workspaceId = parseNumber(req.query.workspaceId);
    const repoId = parseNumber(req.query.repoId);

    if (!workspaceId || !repoId) {
      return res.status(400).json({ message: "workspaceId and repoId are required" });
    }

    const [analysis] = await db
      .select()
      .from(codeAnalysisResults)
      .where(and(eq(codeAnalysisResults.workspaceId, workspaceId), eq(codeAnalysisResults.repoId, repoId)))
      .orderBy(desc(codeAnalysisResults.id))
      .limit(1);

    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    const [simulation] = await db
      .select()
      .from(trafficSimulationResults)
      .where(
        and(
          eq(trafficSimulationResults.workspaceId, workspaceId),
          eq(trafficSimulationResults.repoId, repoId),
          eq(trafficSimulationResults.analysisId, analysis.id),
        ),
      )
      .orderBy(desc(trafficSimulationResults.id))
      .limit(1);

    if (!simulation) {
      return res.status(404).json({ message: "Simulation not found" });
    }

    return res.json({ trafficScenarios: parseJsonArray(simulation.scenariosJson) });
  });

  return httpServer;
}
