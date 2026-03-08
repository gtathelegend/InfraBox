import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const simulationStageValues = [
  "Warmup",
  "Spike",
  "Steady",
  "Recovery",
] as const;

export type SimulationStage = (typeof simulationStageValues)[number];

export type DependencyGraphNode = {
  id: string;
  label: string;
  tier?: "frontend" | "gateway" | "service" | "data";
};

export type DependencyGraphEdge = {
  source: string;
  target: string;
};

export type DependencyGraphPayload = {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
};

export type PipelineStagePayload = {
  name: string;
  status: "success" | "failed" | "running" | "pending";
  durationSec?: number;
  failRate?: number;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auth0Id: text("auth0_id").notNull().unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    authProvider: text("auth_provider").notNull().default("auth0"),
    githubAccessToken: text("github_access_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    auth0IdIdx: uniqueIndex("users_auth0_id_idx").on(table.auth0Id),
  }),
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUniqueIdx: uniqueIndex("workspaces_user_unique_idx").on(table.userId),
  }),
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("github"),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    url: text("url").notNull(),
    githubRepoId: text("github_repo_id"),
    defaultBranch: text("default_branch").notNull().default("main"),
    status: text("status").notNull().default("connected"),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
    lastCommitSha: text("last_commit_sha"),
    lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceRepoUniqueIdx: uniqueIndex("repositories_workspace_full_name_idx").on(
      table.workspaceId,
      table.fullName,
    ),
    workspaceIdx: index("repositories_workspace_idx").on(table.workspaceId),
  }),
);

export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    branch: text("branch").notNull().default("main"),
    detectedTechnologies: jsonb("detected_technologies").$type<string[]>().notNull().default([]),
    detectedServices: jsonb("detected_services").$type<string[]>().notNull().default([]),
    dependencyGraph: jsonb("dependency_graph").$type<DependencyGraphPayload>().notNull().default({ nodes: [], edges: [] }),
    pipelineStages: jsonb("pipeline_stages").$type<PipelineStagePayload[]>().notNull().default([]),
    notes: text("notes"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("analysis_runs_repository_idx").on(table.repositoryId),
  }),
);

export const simulationRuns = pgTable(
  "simulation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    analysisRunId: uuid("analysis_run_id").references(() => analysisRuns.id, { onDelete: "set null" }),
    status: text("status").notNull().default("completed"),
    profile: text("profile").notNull().default("standard"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("simulation_runs_repository_idx").on(table.repositoryId),
  }),
);

export const simulationMetrics = pgTable(
  "simulation_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    simulationRunId: uuid("simulation_run_id").notNull().references(() => simulationRuns.id, { onDelete: "cascade" }),
    stage: text("stage").$type<SimulationStage>().notNull(),
    traffic: integer("traffic").notNull(),
    cpuUsage: integer("cpu_usage").notNull(),
    memoryUsage: integer("memory_usage").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    errorRate: doublePrecision("error_rate").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    simulationIdx: index("simulation_metrics_run_idx").on(table.simulationRunId),
  }),
);

export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    analysisRunId: uuid("analysis_run_id").references(() => analysisRuns.id, { onDelete: "set null" }),
    riskType: text("risk_type").notNull(),
    service: text("service").notNull(),
    probability: integer("probability").notNull(),
    suggestion: text("suggestion").notNull(),
    severity: text("severity").notNull().default("medium"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("predictions_repository_idx").on(table.repositoryId),
  }),
);

export const costPredictions = pgTable(
  "cost_predictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    analysisRunId: uuid("analysis_run_id").references(() => analysisRuns.id, { onDelete: "set null" }),
    monthlyCost: integer("monthly_cost").notNull(),
    spikeCost: integer("spike_cost").notNull(),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("cost_predictions_repository_idx").on(table.repositoryId),
  }),
);

export const infrastructureConfigs = pgTable(
  "infrastructure_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    cpuAllocation: text("cpu_allocation").notNull(),
    memoryAllocation: text("memory_allocation").notNull(),
    replicaCount: integer("replica_count").notNull(),
    autoscalingEnabled: boolean("autoscaling_enabled").notNull().default(false),
    envVars: jsonb("env_vars").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("infrastructure_configs_repository_idx").on(table.repositoryId),
  }),
);

export const trafficProfiles = pgTable(
  "traffic_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    averageUsersPerMinute: integer("average_users_per_minute").notNull(),
    peakUsers: integer("peak_users").notNull(),
    growthPercentage: doublePrecision("growth_percentage").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("traffic_profiles_repository_idx").on(table.repositoryId),
  }),
);

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    environment: text("environment").notNull().default("production"),
    status: text("status").notNull().default("queued"),
    confidenceScore: integer("confidence_score"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("deployments_repository_idx").on(table.repositoryId),
  }),
);

export const monitoringAlerts = pgTable(
  "monitoring_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    severity: text("severity").notNull(),
    metric: text("metric").notNull(),
    value: doublePrecision("value").notNull(),
    threshold: doublePrecision("threshold").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("monitoring_alerts_repository_idx").on(table.repositoryId),
  }),
);

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").references(() => repositories.id, { onDelete: "set null" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("assistant_messages_repository_idx").on(table.repositoryId),
  }),
);

// Compatibility tables for existing pipeline/incident pages.
export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("running"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    costPrediction: integer("cost_prediction").notNull().default(0),
    stages: jsonb("stages").$type<PipelineStagePayload[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdx: index("pipelines_repository_idx").on(table.repositoryId),
  }),
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    severity: text("severity").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    component: text("component").notNull(),
    description: text("description").notNull(),
    suggestedAction: text("suggested_action"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index("incidents_workspace_idx").on(table.workspaceId),
  }),
);

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRepositorySchema = createInsertSchema(repositories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAnalyzedAt: true,
  lastCommitAt: true,
});

export const insertAnalysisRunSchema = createInsertSchema(analysisRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertPredictionSchema = createInsertSchema(predictions).omit({
  id: true,
  createdAt: true,
});

export const insertCostPredictionSchema = createInsertSchema(costPredictions).omit({
  id: true,
  createdAt: true,
});

export const insertInfrastructureConfigSchema = createInsertSchema(infrastructureConfigs).omit({
  id: true,
  createdAt: true,
});

export const insertTrafficProfileSchema = createInsertSchema(trafficProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertDeploymentSchema = createInsertSchema(deployments).omit({
  id: true,
  createdAt: true,
});

export const connectRepositorySchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(1),
  defaultBranch: z.string().min(1).default("main"),
  url: z.string().url(),
  githubRepoId: z.string().optional(),
  lastCommitSha: z.string().optional(),
  lastCommitAt: z.string().optional(),
});

export const runAnalysisRequestSchema = z.object({
  repositoryId: z.string().uuid(),
  branch: z.string().min(1).optional(),
});

export const runSimulationRequestSchema = z.object({
  repositoryId: z.string().uuid(),
  profile: z.enum(["standard", "stress", "soak"]).default("standard"),
});

export const aiChatRequestSchema = z.object({
  repositoryId: z.string().uuid().optional(),
  message: z.string().min(1),
});

export const deployRequestSchema = z.object({
  repositoryId: z.string().uuid(),
  provider: z.enum(["vercel", "vultr"]),
  environment: z.enum(["staging", "production"]).default("production"),
});

export const githubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  owner: z.string(),
  fullName: z.string(),
  defaultBranch: z.string(),
  htmlUrl: z.string().url(),
  private: z.boolean(),
  updatedAt: z.string(),
});

export const dashboardDataSchema = z.object({
  repository: z.object({
    id: z.string().uuid(),
    fullName: z.string(),
    defaultBranch: z.string(),
  }),
  metrics: z.object({
    cpuUsage: z.number(),
    memoryUsage: z.number(),
    latency: z.number(),
    errorRate: z.number(),
    failurePredictionScore: z.number(),
    costPredictionScore: z.number(),
    deploymentScore: z.number(),
    deploymentStatus: z.string(),
    remediationScore: z.number(),
  }),
  trend: z.array(
    z.object({
      hour: z.string(),
      latency: z.number(),
      errors: z.number(),
    }),
  ),
  simulationStages: z.array(
    z.object({
      stage: z.enum(simulationStageValues),
      cpuUsage: z.number(),
      memoryUsage: z.number(),
      latencyMs: z.number(),
      errorRate: z.number(),
      traffic: z.number(),
    }),
  ),
  dependencyGraph: z.object({
    nodes: z.array(z.object({ id: z.string(), label: z.string(), tier: z.string().optional() })),
    edges: z.array(z.object({ source: z.string(), target: z.string() })),
  }),
  pipelineStages: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["success", "failed", "running", "pending"]),
      durationSec: z.number().optional(),
      failRate: z.number().optional(),
    }),
  ),
  predictions: z.array(
    z.object({
      id: z.string().uuid(),
      riskType: z.string(),
      service: z.string(),
      probability: z.number(),
      suggestion: z.string(),
      severity: z.string(),
    }),
  ),
  costPrediction: z.object({
    monthlyCost: z.number(),
    spikeCost: z.number(),
    currency: z.string(),
  }),
  alerts: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      severity: z.string(),
      detail: z.string(),
      status: z.string(),
    }),
  ),
});

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Repository = typeof repositories.$inferSelect;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type SimulationRun = typeof simulationRuns.$inferSelect;
export type SimulationMetric = typeof simulationMetrics.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type CostPrediction = typeof costPredictions.$inferSelect;
export type Deployment = typeof deployments.$inferSelect;
export type MonitoringAlert = typeof monitoringAlerts.$inferSelect;
export type Pipeline = typeof pipelines.$inferSelect;
export type Incident = typeof incidents.$inferSelect;

export type ConnectRepositoryRequest = z.infer<typeof connectRepositorySchema>;
export type CreateRepositoryRequest = ConnectRepositoryRequest;
export type RunAnalysisRequest = z.infer<typeof runAnalysisRequestSchema>;
export type RunSimulationRequest = z.infer<typeof runSimulationRequestSchema>;
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;
export type DeployRequest = z.infer<typeof deployRequestSchema>;
export type DashboardDataResponse = z.infer<typeof dashboardDataSchema>;

export type ChatMessageRequest = {
  message: string;
  repositoryId?: string;
};

export type ChatMessageResponse = {
  reply: string;
};
