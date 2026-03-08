import { eq } from "drizzle-orm";

import {
  type ConnectRepositoryRequest,
  type Incident,
  type Pipeline,
  type Repository,
  type User,
  type Workspace,
  incidents,
  pipelines,
  repositories,
  users,
  workspaces,
} from "@shared/schema";

import { db } from "./db";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getWorkspaces(): Promise<Workspace[]>;
  getRepositories(): Promise<Repository[]>;
  createRepository(repo: ConnectRepositoryRequest & { workspaceId: string }): Promise<Repository>;
  getPipelines(): Promise<Pipeline[]>;
  getPipeline(id: string): Promise<Pipeline | undefined>;
  getIncidents(): Promise<Incident[]>;
  resolveIncident(id: string): Promise<Incident | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return db.select().from(workspaces);
  }

  async getRepositories(): Promise<Repository[]> {
    return db.select().from(repositories);
  }

  async createRepository(
    repo: ConnectRepositoryRequest & { workspaceId: string },
  ): Promise<Repository> {
    const [created] = await db
      .insert(repositories)
      .values({
        workspaceId: repo.workspaceId,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        provider: "github",
        defaultBranch: repo.defaultBranch,
        url: repo.url,
        githubRepoId: repo.githubRepoId,
        status: "connected",
        lastCommitSha: repo.lastCommitSha,
        lastCommitAt: repo.lastCommitAt ? new Date(repo.lastCommitAt) : null,
      })
      .returning();

    return created;
  }

  async getPipelines(): Promise<Pipeline[]> {
    return db.select().from(pipelines);
  }

  async getPipeline(id: string): Promise<Pipeline | undefined> {
    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, id));
    return pipeline;
  }

  async getIncidents(): Promise<Incident[]> {
    return db.select().from(incidents);
  }

  async resolveIncident(id: string): Promise<Incident | undefined> {
    const [incident] = await db
      .update(incidents)
      .set({ status: "resolved" })
      .where(eq(incidents.id, id))
      .returning();

    return incident;
  }
}

export const storage = new DatabaseStorage();
