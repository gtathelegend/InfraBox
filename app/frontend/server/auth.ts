import type { NextFunction, Request, Response } from "express";
import { webcrypto } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "./db";
import {
  repositories,
  users,
  workspaces,
  type User,
  type Workspace,
} from "@shared/schema";

type Auth0Claims = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  aud: string | string[];
  iss: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
};

type JwtHeader = {
  alg: string;
  typ?: string;
  kid?: string;
};

type JwksCache = {
  fetchedAt: number;
  keys: Map<string, JsonWebKey>;
};

const JWKS_TTL_MS = 15 * 60 * 1000;
let jwksCache: JwksCache | null = null;
const cryptoApi = globalThis.crypto ?? webcrypto;

const githubClaimCandidates = [
  process.env.AUTH0_GITHUB_TOKEN_CLAIM,
  "https://infrabox.dev/github_token",
  "https://infrabox.ai/github_token",
  "github_token",
].filter(Boolean) as string[];

declare global {
  namespace Express {
    interface Request {
      authClaims?: Auth0Claims;
      currentUser?: User;
      currentWorkspace?: Workspace;
    }
  }
}

function normalizeAuth0Domain(): string {
  const raw = process.env.AUTH0_DOMAIN;
  if (!raw) {
    throw new Error("AUTH0_DOMAIN is not configured");
  }

  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function decodeBase64Url(input: string): Buffer {
  const padded = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=");

  return Buffer.from(padded, "base64");
}

function parseJwtPart<T>(part: string): T {
  const decoded = decodeBase64Url(part).toString("utf8");
  return JSON.parse(decoded) as T;
}

function parseBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

async function fetchJwks(): Promise<Map<string, JsonWebKey>> {
  const domain = normalizeAuth0Domain();
  const response = await fetch(`https://${domain}/.well-known/jwks.json`);

  if (!response.ok) {
    throw new Error(`Unable to load Auth0 JWKS (${response.status})`);
  }

  const payload = (await response.json()) as { keys?: JsonWebKey[] };
  const keys = payload.keys ?? [];

  const map = new Map<string, JsonWebKey>();
  for (const jwk of keys) {
    const kid = (jwk as JsonWebKey & { kid?: string }).kid;
    if (kid) {
      map.set(kid, jwk);
    }
  }

  return map;
}

async function getJwkByKid(kid: string): Promise<JsonWebKey> {
  const now = Date.now();

  if (!jwksCache || now - jwksCache.fetchedAt > JWKS_TTL_MS) {
    jwksCache = {
      fetchedAt: now,
      keys: await fetchJwks(),
    };
  }

  const cached = jwksCache.keys.get(kid);
  if (cached) {
    return cached;
  }

  jwksCache = {
    fetchedAt: now,
    keys: await fetchJwks(),
  };

  const refreshed = jwksCache.keys.get(kid);
  if (!refreshed) {
    throw new Error("Signing key not found for token");
  }

  return refreshed;
}

function validateClaims(payload: Auth0Claims): void {
  const nowEpoch = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowEpoch) {
    throw new Error("Token expired");
  }

  const expectedIssuer = `https://${normalizeAuth0Domain()}/`;
  if (payload.iss !== expectedIssuer) {
    throw new Error("Token issuer mismatch");
  }

  const expectedAudience = process.env.AUTH0_AUDIENCE;
  if (expectedAudience) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(expectedAudience)) {
      throw new Error("Token audience mismatch");
    }
  }

  if (!payload.sub) {
    throw new Error("Token subject missing");
  }
}

async function verifyJwt(token: string): Promise<Auth0Claims> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = parseJwtPart<JwtHeader>(headerPart);
  const payload = parseJwtPart<Auth0Claims>(payloadPart);

  if (header.alg !== "RS256") {
    throw new Error("Unsupported JWT algorithm");
  }

  if (!header.kid) {
    throw new Error("JWT key id is missing");
  }

  const jwk = await getJwkByKid(header.kid);

  const key = await cryptoApi.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const signature = decodeBase64Url(signaturePart);

  const isValid = await cryptoApi.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  if (!isValid) {
    throw new Error("JWT signature invalid");
  }

  validateClaims(payload);
  return payload;
}

function readGitHubTokenFromClaims(claims: Auth0Claims): string | null {
  for (const claim of githubClaimCandidates) {
    const value = claims[claim];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

export function getGitHubToken(req: Request): string | null {
  const directHeaderToken = req.headers["x-github-token"];
  if (typeof directHeaderToken === "string" && directHeaderToken.trim().length > 0) {
    return directHeaderToken;
  }

  if (req.currentUser?.githubAccessToken) {
    return req.currentUser.githubAccessToken;
  }

  if (req.authClaims) {
    return readGitHubTokenFromClaims(req.authClaims);
  }

  return null;
}

export async function verifyAuth0Token(req: Request, res: Response, next: NextFunction) {
  try {
    const token = parseBearerToken(req);

    if (!token) {
      if (process.env.AUTH0_BYPASS === "true") {
        req.authClaims = {
          sub: process.env.DEV_AUTH0_SUB ?? "auth0|dev-user",
          email: process.env.DEV_AUTH0_EMAIL ?? "dev@infrabox.ai",
          name: process.env.DEV_AUTH0_NAME ?? "Infrabox Dev",
          picture: process.env.DEV_AUTH0_PICTURE,
          aud: process.env.AUTH0_AUDIENCE ?? "infrabox-api",
          iss: `https://${normalizeAuth0Domain()}/`,
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          iat: Math.floor(Date.now() / 1000),
        };
        return next();
      }

      return res.status(401).json({ message: "Missing bearer token" });
    }

    req.authClaims = await verifyJwt(token);
    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return res.status(401).json({ message });
  }
}

export async function ensureWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const claims = req.authClaims;
    if (!claims) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const email = claims.email ?? `${claims.sub.replace(/[^a-zA-Z0-9]/g, "_")}@auth0.local`;
    const name = claims.name ?? email.split("@")[0] ?? "Infrabox User";
    const githubToken = readGitHubTokenFromClaims(claims);

    const [user] = await db
      .insert(users)
      .values({
        auth0Id: claims.sub,
        email,
        name,
        avatarUrl: claims.picture,
        githubAccessToken: githubToken,
      })
      .onConflictDoUpdate({
        target: users.auth0Id,
        set: {
          email,
          name,
          avatarUrl: claims.picture,
          githubAccessToken: githubToken ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await db
      .insert(workspaces)
      .values({
        userId: user.id,
        name: `${name.split(" ")[0] ?? "Infrabox"} Workspace`,
      })
      .onConflictDoNothing({ target: workspaces.userId });

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, user.id))
      .limit(1);

    if (!workspace) {
      return res.status(500).json({ message: "Unable to initialize workspace" });
    }

    req.currentUser = user;
    req.currentWorkspace = workspace;
    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace initialization failed";
    return res.status(500).json({ message });
  }
}

export function requireWorkspace(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser || !req.currentWorkspace) {
    return res.status(401).json({ message: "Workspace context missing" });
  }

  return next();
}

export async function loadRepositoryForWorkspace(
  workspaceId: string,
  repositoryId: string,
) {
  const [repo] = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.id, repositoryId),
        eq(repositories.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  return repo;
}
