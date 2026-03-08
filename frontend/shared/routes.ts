import { z } from "zod";
import {
  aiChatRequestSchema,
  connectRepositorySchema,
  dashboardDataSchema,
  deployRequestSchema,
  githubRepositorySchema,
  incidents,
  pipelines,
  repositories,
  runAnalysisRequestSchema,
  runSimulationRequestSchema,
  users,
  workspaces,
  insertInfrastructureConfigSchema,
  insertTrafficProfileSchema,
} from "./schema";

const validationErrorSchema = z.object({
  message: z.string(),
  field: z.string().optional(),
});

const notFoundErrorSchema = z.object({
  message: z.string(),
});

const unauthorizedErrorSchema = z.object({
  message: z.string(),
});

const infrastructureConfigSchema = z.object({
  repositoryId: z.string().uuid(),
  provider: z.enum(["AWS", "Vercel", "Vultr", "Kubernetes", "Docker Server", "Custom Server", "Render"]),
  cpuAllocation: z.string(),
  memoryAllocation: z.string(),
  replicaCount: z.number().int().positive(),
  autoscalingEnabled: z.boolean(),
  averageUsersPerMinute: z.number().int().positive(),
  peakUsers: z.number().int().positive(),
  growthPercentage: z.number().positive(),
  envVars: z.record(z.string()),
});

export const api = {
  auth: {
    me: {
      method: "GET" as const,
      path: "/api/auth/me" as const,
      responses: {
        200: z.object({
          id: z.string(),
          email: z.string().email(),
          name: z.string(),
          avatarUrl: z.string().nullable().optional(),
          workspaceId: z.string(),
        }),
        401: unauthorizedErrorSchema,
      },
    },
  },
  users: {
    me: {
      method: "GET" as const,
      path: "/api/users/me" as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
      },
    },
  },
  workspaces: {
    current: {
      method: "GET" as const,
      path: "/api/workspaces/current" as const,
      responses: {
        200: z.custom<typeof workspaces.$inferSelect>(),
      },
    },
  },
  github: {
    repos: {
      method: "GET" as const,
      path: "/api/github/repos" as const,
      responses: {
        200: z.array(githubRepositorySchema),
        401: unauthorizedErrorSchema,
      },
    },
  },
  repositories: {
    list: {
      method: "GET" as const,
      path: "/api/repositories" as const,
      responses: {
        200: z.array(z.custom<typeof repositories.$inferSelect>()),
      },
    },
    connect: {
      method: "POST" as const,
      path: "/api/repositories/connect" as const,
      input: connectRepositorySchema,
      responses: {
        201: z.custom<typeof repositories.$inferSelect>(),
        400: validationErrorSchema,
      },
    },
  },
  analysis: {
    run: {
      method: "POST" as const,
      path: "/api/analysis/run" as const,
      input: runAnalysisRequestSchema,
      responses: {
        200: z.object({
          runId: z.string().uuid(),
          status: z.string(),
          repositoryId: z.string().uuid(),
        }),
      },
    },
    latest: {
      method: "GET" as const,
      path: "/api/analysis/:repositoryId/latest" as const,
      responses: {
        200: z.any(),
        404: notFoundErrorSchema,
      },
    },
    start: {
      method: "POST" as const,
      path: "/api/analysis/start" as const,
      input: z.object({
        repositoryId: z.string().uuid(),
      }),
      responses: {
        200: z.object({
          runId: z.string().uuid(),
          status: z.string(),
        }),
        400: validationErrorSchema,
      },
    },
  },
  simulations: {
    run: {
      method: "POST" as const,
      path: "/api/simulations/run" as const,
      input: runSimulationRequestSchema,
      responses: {
        200: z.object({
          runId: z.string().uuid(),
          status: z.string(),
          repositoryId: z.string().uuid(),
        }),
      },
    },
    latest: {
      method: "GET" as const,
      path: "/api/simulations/:repositoryId/latest" as const,
      responses: {
        200: z.any(),
      },
    },
  },
  infrastructure: {
    configure: {
      method: "POST" as const,
      path: "/api/infrastructure/configure" as const,
      input: infrastructureConfigSchema,
      responses: {
        201: z.object({
          configId: z.string().uuid(),
          repositoryId: z.string().uuid(),
        }),
        400: validationErrorSchema,
      },
    },
  },
  predictions: {
    latest: {
      method: "GET" as const,
      path: "/api/predictions/:repositoryId/latest" as const,
      responses: {
        200: z.array(z.any()),
      },
    },
  },
  costs: {
    latest: {
      method: "GET" as const,
      path: "/api/costs/:repositoryId/latest" as const,
      responses: {
        200: z.any(),
      },
    },
  },
  dashboard: {
    get: {
      method: "GET" as const,
      path: "/api/dashboard/:repositoryId" as const,
      responses: {
        200: dashboardDataSchema,
      },
    },
  },
  deploy: {
    run: {
      method: "POST" as const,
      path: "/api/deploy" as const,
      input: deployRequestSchema,
      responses: {
        200: z.object({
          deploymentId: z.string().uuid(),
          status: z.string(),
          provider: z.string(),
          environment: z.string(),
        }),
      },
    },
  },
  monitoring: {
    get: {
      method: "GET" as const,
      path: "/api/monitoring/:repositoryId" as const,
      responses: {
        200: z.object({
          alerts: z.array(z.any()),
          latest: z.any(),
        }),
      },
    },
  },
  chat: {
    send: {
      method: "POST" as const,
      path: "/api/ai/chat" as const,
      input: aiChatRequestSchema,
      responses: {
        200: z.object({
          reply: z.string(),
          suggestions: z.array(z.string()).default([]),
        }),
      },
    },
  },
  pipelines: {
    list: {
      method: "GET" as const,
      path: "/api/pipelines" as const,
      responses: {
        200: z.array(z.custom<typeof pipelines.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/pipelines/:id" as const,
      responses: {
        200: z.custom<typeof pipelines.$inferSelect>(),
        404: notFoundErrorSchema,
      },
    },
  },
  incidents: {
    list: {
      method: "GET" as const,
      path: "/api/incidents" as const,
      responses: {
        200: z.array(z.custom<typeof incidents.$inferSelect>()),
      },
    },
    resolve: {
      method: "POST" as const,
      path: "/api/incidents/:id/resolve" as const,
      responses: {
        200: z.custom<typeof incidents.$inferSelect>(),
        404: notFoundErrorSchema,
      },
    },
  },
} as const;

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, encodeURIComponent(String(value)));
    }
  }
  return url;
}
