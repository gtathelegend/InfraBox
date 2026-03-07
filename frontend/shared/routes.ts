import { z } from 'zod';
import {
  createInfrastructureRequestSchema,
  insertRepositorySchema,
  incidents,
  pipelines,
  repositories,
  users,
  workspaces,
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  me: {
    get: {
      method: 'GET' as const,
      path: '/api/me' as const,
      responses: {
        200: z.object({
          user: z.custom<typeof users.$inferSelect>(),
          workspace: z.custom<typeof workspaces.$inferSelect>(),
          role: z.string(),
        }),
      }
    }
  },
  users: {
    me: {
      method: 'GET' as const,
      path: '/api/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
      }
    }
  },
  workspaces: {
    list: {
      method: 'GET' as const,
      path: '/api/workspaces' as const,
      responses: {
        200: z.array(z.custom<typeof workspaces.$inferSelect>()),
      }
    }
  },
  repositories: {
    list: {
      method: 'GET' as const,
      path: '/api/git/repos' as const,
      responses: {
        200: z.array(z.custom<typeof repositories.$inferSelect>()),
      },
    },
    connect: {
      method: 'POST' as const,
      path: '/api/git/connect' as const,
      input: insertRepositorySchema,
      responses: {
        201: z.custom<typeof repositories.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    branches: {
      method: 'GET' as const,
      path: '/api/git/repos/:repoId/branches' as const,
      responses: {
        200: z.object({ branches: z.array(z.string()) }),
      },
    },
    pipelines: {
      method: 'GET' as const,
      path: '/api/git/repos/:repoId/pipelines' as const,
      responses: {
        200: z.object({ stages: z.array(z.string()) }),
      },
    },
  },
  pipelines: {
    list: {
      method: 'GET' as const,
      path: '/api/pipelines' as const,
      responses: {
        200: z.array(z.custom<typeof pipelines.$inferSelect>()),
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/pipelines/:id' as const,
      responses: {
        200: z.custom<typeof pipelines.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    }
  },
  incidents: {
    list: {
      method: 'GET' as const,
      path: '/api/incidents' as const,
      responses: {
        200: z.array(z.custom<typeof incidents.$inferSelect>()),
      }
    },
    resolve: {
      method: 'POST' as const,
      path: '/api/incidents/:id/resolve' as const,
      responses: {
        200: z.custom<typeof incidents.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    }
  },
  infrastructure: {
    config: {
      method: 'POST' as const,
      path: '/api/infrastructure/config' as const,
      input: createInfrastructureRequestSchema,
      responses: {
        201: z.object({ configId: z.number(), workspaceId: z.number(), repoId: z.number() }),
      },
    },
    compatibility: {
      method: 'POST' as const,
      path: '/api/infrastructure/compatibility' as const,
      input: z.object({
        workspaceId: z.coerce.number().int().positive(),
        repoId: z.coerce.number().int().positive(),
        analysisId: z.coerce.number().int().positive(),
      }),
      responses: {
        200: z.object({
          result: z.string(),
          serverMemoryGb: z.number(),
          predictedMemoryGb: z.number(),
          serverCpuCores: z.number(),
          predictedCpuCores: z.number(),
          risks: z.array(z.string()),
        }),
      }
    },
  },
  analysis: {
    run: {
      method: 'POST' as const,
      path: '/api/analysis/run' as const,
      input: z.object({
        workspaceId: z.coerce.number().int().positive(),
        repoId: z.coerce.number().int().positive(),
      }),
      responses: {
        202: z.object({ jobId: z.number(), status: z.string() }),
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/analysis/jobs/:jobId' as const,
      responses: {
        200: z.object({
          jobId: z.number(),
          status: z.string(),
          analysisId: z.number().nullable(),
          error: z.string().nullable().optional(),
        }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/analysis' as const,
      responses: {
        200: z.any(),
      },
    },
  },
  dashboard: {
    result: {
      method: 'GET' as const,
      path: '/api/dashboard/result' as const,
      responses: {
        200: z.any(),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
