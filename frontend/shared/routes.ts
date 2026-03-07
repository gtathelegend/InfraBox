import { z } from 'zod';
import { 
  insertRepositorySchema, 
  repositories, 
  pipelines, 
  incidents, 
  users,
  workspaces
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
  users: {
    me: {
      method: 'GET' as const,
      path: '/api/users/me' as const,
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
      path: '/api/repositories' as const,
      responses: {
        200: z.array(z.custom<typeof repositories.$inferSelect>()),
      },
    },
    connect: {
      method: 'POST' as const,
      path: '/api/repositories' as const,
      input: insertRepositorySchema,
      responses: {
        201: z.custom<typeof repositories.$inferSelect>(),
        400: errorSchemas.validation,
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
  chat: {
    send: {
      method: 'POST' as const,
      path: '/api/chat' as const,
      input: z.object({ message: z.string() }),
      responses: {
        200: z.object({ reply: z.string() }),
      }
    }
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
