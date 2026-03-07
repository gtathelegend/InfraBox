import { db } from "./db";
import {
  users,
  workspaces,
  repositories,
  pipelines,
  incidents,
  type User,
  type Workspace,
  type Repository,
  type Pipeline,
  type Incident,
  type CreateRepositoryRequest
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getWorkspaces(): Promise<Workspace[]>;
  getRepositories(): Promise<Repository[]>;
  createRepository(repo: CreateRepositoryRequest): Promise<Repository>;
  getPipelines(): Promise<Pipeline[]>;
  getPipeline(id: number): Promise<Pipeline | undefined>;
  getIncidents(): Promise<Incident[]>;
  resolveIncident(id: number): Promise<Incident | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return await db.select().from(workspaces);
  }

  async getRepositories(): Promise<Repository[]> {
    return await db.select().from(repositories);
  }

  async createRepository(repo: CreateRepositoryRequest): Promise<Repository> {
    const [newRepo] = await db.insert(repositories).values(repo).returning();
    return newRepo;
  }

  async getPipelines(): Promise<Pipeline[]> {
    return await db.select().from(pipelines);
  }

  async getPipeline(id: number): Promise<Pipeline | undefined> {
    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, id));
    return pipeline;
  }

  async getIncidents(): Promise<Incident[]> {
    return await db.select().from(incidents);
  }

  async resolveIncident(id: number): Promise<Incident | undefined> {
    const [incident] = await db.update(incidents)
      .set({ status: 'resolved' })
      .where(eq(incidents.id, id))
      .returning();
    return incident;
  }
}

export const storage = new DatabaseStorage();
