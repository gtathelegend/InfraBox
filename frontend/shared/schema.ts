import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Core identity and workspace tables.

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  auth0Id: text("auth0_id").notNull().unique(),
  name: text("name"),
  email: text("email").notNull().unique(),
  workspaceId: integer("workspace_id"),
  role: text("role").notNull().default("Owner"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const repositories = sqliteTable("repositories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  externalRepoId: text("external_repo_id"),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  url: text("url").notNull(),
  status: text("status").notNull().default("connected"),
  defaultBranch: text("default_branch"),
  lastAnalyzed: text("last_analyzed"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// Legacy-compatible tables still used by some existing views.
export const pipelines = sqliteTable("pipelines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repositoryId: integer("repository_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  confidenceScore: integer("confidence_score"),
  costPrediction: integer("cost_prediction"),
  stages: text("stages"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const incidents = sqliteTable("incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  component: text("component").notNull(),
  description: text("description").notNull(),
  suggestedAction: text("suggested_action"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const infrastructureConfigs = sqliteTable("infrastructure_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  repoId: integer("repo_id").notNull(),
  provider: text("provider").notNull(),
  cpu: integer("cpu").notNull(),
  memoryGb: integer("memory_gb").notNull(),
  storageGb: integer("storage_gb").notNull(),
  autoscaling: integer("autoscaling", { mode: "boolean" }).notNull().default(false),
  region: text("region").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const codeAnalysisResults = sqliteTable("code_analysis_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  repoId: integer("repo_id").notNull(),
  infrastructureConfigId: integer("infrastructure_config_id"),
  framework: text("framework"),
  backend: text("backend"),
  language: text("language"),
  servicesJson: text("services_json"),
  dependenciesJson: text("dependencies_json"),
  database: text("database"),
  cache: text("cache"),
  estimatedMemoryGb: integer("estimated_memory_gb"),
  estimatedCpuCores: integer("estimated_cpu_cores"),
  pipelineStagesJson: text("pipeline_stages_json"),
  pipelineGraphJson: text("pipeline_graph_json"),
  serviceDependencyGraphJson: text("service_dependency_graph_json"),
  rawJson: text("raw_json"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const trafficSimulationResults = sqliteTable("traffic_simulation_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  repoId: integer("repo_id").notNull(),
  analysisId: integer("analysis_id").notNull(),
  scenariosJson: text("scenarios_json").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const infrastructureCompatibilityResults = sqliteTable(
  "infrastructure_compatibility_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id").notNull(),
    repoId: integer("repo_id").notNull(),
    analysisId: integer("analysis_id").notNull(),
    infrastructureConfigId: integer("infrastructure_config_id").notNull(),
    serverMemoryGb: integer("server_memory_gb").notNull(),
    predictedMemoryGb: integer("predicted_memory_gb").notNull(),
    serverCpuCores: integer("server_cpu_cores").notNull(),
    predictedCpuCores: integer("predicted_cpu_cores").notNull(),
    result: text("result").notNull(),
    risksJson: text("risks_json").notNull(),
    createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  },
);

export const preventiveSuggestions = sqliteTable("preventive_suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  repoId: integer("repo_id").notNull(),
  analysisId: integer("analysis_id").notNull(),
  issue: text("issue").notNull(),
  solution: text("solution").notNull(),
  codeLocation: text("code_location"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const analysisJobs = sqliteTable("analysis_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  repoId: integer("repo_id").notNull(),
  status: text("status").notNull().default("queued"),
  analysisId: integer("analysis_id"),
  error: text("error"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true });
export const insertRepositorySchema = createInsertSchema(repositories).omit({ id: true });
export const insertPipelineSchema = createInsertSchema(pipelines).omit({ id: true, createdAt: true });
export const insertIncidentSchema = createInsertSchema(incidents).omit({ id: true, createdAt: true });
export const insertInfrastructureConfigSchema = createInsertSchema(infrastructureConfigs).omit({
  id: true,
  createdAt: true,
});

export const createInfrastructureRequestSchema = z.object({
  workspaceId: z.coerce.number().int().positive(),
  repoId: z.coerce.number().int().positive(),
  provider: z.string().min(1),
  cpu: z.coerce.number().int().positive(),
  memoryGb: z.coerce.number().int().positive(),
  storageGb: z.coerce.number().int().positive(),
  autoscaling: z.boolean(),
  region: z.string().min(1),
});

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Repository = typeof repositories.$inferSelect;
export type InfrastructureConfig = typeof infrastructureConfigs.$inferSelect;
export type Pipeline = typeof pipelines.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type CodeAnalysisResult = typeof codeAnalysisResults.$inferSelect;
export type TrafficSimulationResult = typeof trafficSimulationResults.$inferSelect;
export type InfrastructureCompatibilityResult = typeof infrastructureCompatibilityResults.$inferSelect;
export type PreventiveSuggestion = typeof preventiveSuggestions.$inferSelect;
export type AnalysisJob = typeof analysisJobs.$inferSelect;

export type CreateRepositoryRequest = z.infer<typeof insertRepositorySchema>;
export type CreateInfrastructureRequest = z.infer<typeof createInfrastructureRequestSchema>;
