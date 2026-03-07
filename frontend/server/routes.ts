import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { db } from "./db";
import { users, workspaces, repositories, pipelines, incidents } from "@shared/schema";

async function seedDatabase() {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    const [user] = await db.insert(users).values({
      name: "Demo User",
      email: "demo@infrabox.ai",
      role: "admin",
    }).returning();

    const [workspace] = await db.insert(workspaces).values({
      name: "Infrabox Demo",
      ownerId: user.id,
    }).returning();

    const [repo1] = await db.insert(repositories).values({
      workspaceId: workspace.id,
      name: "frontend-app",
      provider: "github",
      url: "https://github.com/demo/frontend-app",
      status: "connected",
    }).returning();

    const [repo2] = await db.insert(repositories).values({
      workspaceId: workspace.id,
      name: "payment-service",
      provider: "gitlab",
      url: "https://gitlab.com/demo/payment-service",
      status: "connected",
    }).returning();

    await db.insert(pipelines).values([
      {
        repositoryId: repo1.id,
        name: "Deploy to Prod",
        status: "success",
        confidenceScore: 95,
        costPrediction: 320,
        stages: ["Build", "Test", "Security Scan", "Deploy"]
      },
      {
        repositoryId: repo2.id,
        name: "Deploy to Staging",
        status: "failed",
        confidenceScore: 45,
        costPrediction: 780,
        stages: ["Build", "Test", "Security Scan", "Deploy"]
      }
    ]);

    await db.insert(incidents).values([
      {
        workspaceId: workspace.id,
        title: "Memory Leak Detected",
        severity: "high",
        status: "open",
        component: "payment-service",
        description: "Payment service exceeds memory limits during peak traffic.",
        suggestedAction: "Increase container memory to 2GB and restart service."
      },
      {
        workspaceId: workspace.id,
        title: "High Cloud Cost",
        severity: "medium",
        status: "open",
        component: "recommendation-service",
        description: "Two instances are underutilized leading to wasted spending.",
        suggestedAction: "Terminate idle instances. Estimated savings: $210/month."
      }
    ]);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed initial data
  seedDatabase().catch(console.error);

  app.get(api.users.me.path, async (req, res) => {
    // Return dummy user for demo
    const user = await storage.getUser(1);
    res.json(user);
  });

  app.get(api.workspaces.list.path, async (req, res) => {
    const w = await storage.getWorkspaces();
    res.json(w);
  });

  app.get(api.repositories.list.path, async (req, res) => {
    const repos = await storage.getRepositories();
    res.json(repos);
  });

  app.get("/api/repos", async (req, res) => {
    const repos = await storage.getRepositories();
    res.json(repos);
  });

  app.post(api.repositories.connect.path, async (req, res) => {
    try {
      const input = api.repositories.connect.input.parse(req.body);
      const repo = await storage.createRepository(input);
      res.status(201).json(repo);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.pipelines.list.path, async (req, res) => {
    const p = await storage.getPipelines();
    res.json(p);
  });

  app.get(api.pipelines.get.path, async (req, res) => {
    const p = await storage.getPipeline(Number(req.params.id));
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  });

  app.get(api.incidents.list.path, async (req, res) => {
    const i = await storage.getIncidents();
    res.json(i);
  });

  app.post(api.incidents.resolve.path, async (req, res) => {
    const i = await storage.resolveIncident(Number(req.params.id));
    if (!i) return res.status(404).json({ message: "Not found" });
    res.json(i);
  });

  app.post(api.chat.send.path, async (req, res) => {
    const { message } = req.body;
    let reply = "I am the DevOps Assistant. How can I help you optimize your infrastructure today?";
    
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("fail")) {
      reply = "Payment service memory exceeded container limit. I suggest increasing the container memory.";
    } else if (lowerMsg.includes("cost") || lowerMsg.includes("reduce")) {
      reply = "Two instances are underutilized. Estimated savings: $210/month. Shall I terminate them?";
    } else if (lowerMsg.includes("deploy")) {
      reply = "Your deployment confidence score is currently 82/100. It is safe to deploy.";
    }

    res.json({ reply });
  });

  const analyzeSchema = z.object({
    repo: z.string().min(1),
  });

  app.post("/analyze", async (req, res) => {
    try {
      const input = analyzeSchema.parse(req.body);
      await new Promise((resolve) => setTimeout(resolve, 250));
      res.status(200).json({
        status: "queued",
        repo: input.repo,
        message: "Repository analysis initialized",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  const sendAnalysis = (repo: string) => ({
    repo,
    architectureScore: 87,
    riskScore: 32,
    deploymentConfidence: 84,
  });

  app.get("/api/analysis", async (req, res) => {
    const repo = String(req.query.repo ?? "MyPortfolio");
    res.json(sendAnalysis(repo));
  });

  app.get("/analysis", async (req, res) => {
    const repo = String(req.query.repo ?? "MyPortfolio");
    res.json(sendAnalysis(repo));
  });

  app.get("/api/pipeline", async (req, res) => {
    const repo = String(req.query.repo ?? "MyPortfolio");
    res.json({
      repo,
      stages: ["Build", "Test", "Security Scan", "Container Build", "Deploy"],
      slowestStage: "Test",
      failureProbability: 0.18,
    });
  });

  app.get("/api/pipeline/:repoId", async (req, res) => {
    const pipelineList = await storage.getPipelines();
    const candidate = pipelineList.find((item) => String(item.repositoryId) === String(req.params.repoId)) ?? pipelineList[0];

    const stages: string[] = Array.isArray(candidate?.stages)
      ? candidate.stages
      : typeof candidate?.stages === "string"
        ? candidate.stages
            .split(",")
            .map((stage) => stage.trim())
            .filter(Boolean)
        : ["Build", "Test", "Security Scan", "Deploy"];

    res.json({
      nodes: stages.map((stage) => ({ id: stage })),
      edges: stages.slice(0, -1).map((stage: string, index: number) => ({
        source: stage,
        target: stages[index + 1],
      })),
    });
  });

  app.get("/api/deploy/history", async (req, res) => {
    const pipelineList = await storage.getPipelines();
    const deployments = pipelineList.map((pipeline) => ({
      deploymentId: String(pipeline.id),
      deploymentStatus: pipeline.status,
      targetEnvironment: pipeline.name.toLowerCase().includes("prod") ? "production" : "staging",
      startedAt: pipeline.createdAt,
    }));

    res.json({
      count: deployments.length,
      deployments,
    });
  });

  app.post("/api/deploy/run", async (req, res) => {
    const body = req.body as { repositoryId?: number; targetEnvironment?: string };
    res.json({
      message: "Deployment trigger accepted",
      deploymentId: `${Date.now()}`,
      deploymentStatus: "running",
      repositoryId: body.repositoryId ?? null,
      targetEnvironment: body.targetEnvironment ?? "staging",
      updatedAt: new Date().toISOString(),
    });
  });

  app.post("/api/assistant/query", async (req, res) => {
    const { workspaceId, query } = req.body as { workspaceId?: string; query?: string };

    if (!workspaceId || !query) {
      return res.status(400).json({
        message: "workspaceId and query are required",
      });
    }

    const lowerQuery = query.toLowerCase();
    let answer = "Infrastructure is stable with no critical incidents.";
    if (lowerQuery.includes("fail")) {
      answer = "Payment service memory exceeded container limit.";
    } else if (lowerQuery.includes("deploy")) {
      answer = "Deployment risk is elevated due to memory pressure in payment-service.";
    } else if (lowerQuery.includes("cost")) {
      answer = "Two worker instances are underutilized and can be rightsized.";
    }

    return res.json({
      answer,
      supportingData: {
        cpuUsage: "92%",
        memoryUsage: "88%",
      },
    });
  });

  app.get("/api/monitoring/metrics", async (_req, res) => {
    res.json({
      cpuUsage: 65,
      memoryUsage: 58,
      latency: 120,
      errorRate: 0.02,
      traffic: 3200,
      timestamp: new Date().toISOString(),
    });
  });

  const sendSimulation = (repo: string) => ({
    repo,
    cpu: 72,
    memory: 79,
    latency: 182,
    errorRate: 1.8,
  });

  app.get("/api/simulation", async (req, res) => {
    const repo = String(req.query.repo ?? "MyPortfolio");
    res.json(sendSimulation(repo));
  });

  app.get("/simulation", async (req, res) => {
    const repo = String(req.query.repo ?? "MyPortfolio");
    res.json(sendSimulation(repo));
  });

  return httpServer;
}
