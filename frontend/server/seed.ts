import { db } from "./db";
import { users, workspaces, repositories, pipelines, incidents } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Create default users
  const user1 = await db.insert(users).values({
    name: "John Doe",
    email: "john@example.com",
    avatarUrl: "https://github.com/octocat.png",
    role: "admin",
  }).returning();

  const user2 = await db.insert(users).values({
    name: "Jane Smith",
    email: "jane@example.com",
    avatarUrl: "https://github.com/octocat.png",
    role: "developer",
  }).returning();

  console.log("Created users:", user1, user2);

  // Create workspaces
  const workspace1 = await db.insert(workspaces).values({
    name: "My Workspace",
    ownerId: user1[0].id,
  }).returning();

  console.log("Created workspace:", workspace1);

  // Create repositories
  const repo1 = await db.insert(repositories).values({
    workspaceId: workspace1[0].id,
    name: "website-ui-builder",
    provider: "github",
    url: "https://github.com/example/website-ui-builder",
    status: "connected",
    lastAnalyzed: new Date().toISOString(),
  }).returning();

  const repo2 = await db.insert(repositories).values({
    workspaceId: workspace1[0].id,
    name: "api-service",
    provider: "github",
    url: "https://github.com/example/api-service",
    status: "connected",
    lastAnalyzed: new Date().toISOString(),
  }).returning();

  console.log("Created repositories:", repo1, repo2);

  // Create pipelines
  const pipeline1 = await db.insert(pipelines).values({
    repositoryId: repo1[0].id,
    name: "Build and Deploy",
    status: "success",
    confidenceScore: 95,
    costPrediction: 50,
    stages: JSON.stringify([
      { name: "Build", status: "success", duration: 120 },
      { name: "Test", status: "success", duration: 60 },
      { name: "Deploy", status: "success", duration: 30 },
    ]),
  }).returning();

  const pipeline2 = await db.insert(pipelines).values({
    repositoryId: repo2[0].id,
    name: "CI/CD Pipeline",
    status: "running",
    confidenceScore: 88,
    costPrediction: 75,
    stages: JSON.stringify([
      { name: "Lint", status: "success", duration: 45 },
      { name: "Build", status: "running", duration: 0 },
      { name: "Test", status: "pending", duration: 0 },
    ]),
  }).returning();

  console.log("Created pipelines:", pipeline1, pipeline2);

  // Create incidents
  const incident1 = await db.insert(incidents).values({
    workspaceId: workspace1[0].id,
    title: "Database Connection Timeout",
    severity: "high",
    status: "open",
    component: "Database",
    description: "The application is experiencing intermittent database connection timeouts, affecting user authentication.",
    suggestedAction: "Check database server logs and connection pool settings.",
  }).returning();

  const incident2 = await db.insert(incidents).values({
    workspaceId: workspace1[0].id,
    title: "Memory Leak in Worker Process",
    severity: "medium",
    status: "resolved",
    component: "Worker Service",
    description: "Worker processes were consuming increasing amounts of memory over time.",
    suggestedAction: "Updated worker process to properly clean up resources after job completion.",
  }).returning();

  console.log("Created incidents:", incident1, incident2);

  console.log("Seeding completed!");
}

seed().catch(console.error);