import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("developer"),
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
  name: text("name").notNull(),
  provider: text("provider").notNull(), // github, gitlab, bitbucket
  url: text("url").notNull(),
  status: text("status").notNull().default("connected"),
  lastAnalyzed: text("last_analyzed"),
});

export const pipelines = sqliteTable("pipelines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repositoryId: integer("repository_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(), // success, failed, running
  confidenceScore: integer("confidence_score"), // 0-100
  costPrediction: integer("cost_prediction"), // estimated cost
  stages: text("stages"), // JSON string of stages
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const incidents = sqliteTable("incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  title: text("title").notNull(),
  severity: text("severity").notNull(), // high, medium, low
  status: text("status").notNull(), // open, resolved
  component: text("component").notNull(),
  description: text("description").notNull(),
  suggestedAction: text("suggested_action"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true });
export const insertRepositorySchema = createInsertSchema(repositories).omit({ id: true });
export const insertPipelineSchema = createInsertSchema(pipelines).omit({ id: true, createdAt: true });
export const insertIncidentSchema = createInsertSchema(incidents).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Repository = typeof repositories.$inferSelect;
export type Pipeline = typeof pipelines.$inferSelect;
export type Incident = typeof incidents.$inferSelect;

export type CreateRepositoryRequest = z.infer<typeof insertRepositorySchema>;
export type RepositoryResponse = Repository;

export type PipelineResponse = Pipeline;

export type IncidentResponse = Incident;

export type ChatMessageRequest = {
  message: string;
};

export type ChatMessageResponse = {
  reply: string;
};
