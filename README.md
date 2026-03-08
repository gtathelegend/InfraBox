# InfraBox

InfraBox is an AI-powered DevOps intelligence platform focused on repository analysis, pipeline visibility, deployment risk scoring, simulation, and assistant-driven operational insights.

This repository currently contains multiple app variants. The active, production-oriented stack is the `frontend/` app (React + Vite client + Express API in one runtime), with optional secondary work in `backend/` (Next.js UI + standalone Express/Mongo API).

## Table of Contents

- [What InfraBox Does](#what-infrabox-does)
- [Repository Layout](#repository-layout)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start (Primary App)](#quick-start-primary-app)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Secondary Stack (backend/)](#secondary-stack-backend)
- [API Surface (High-Level)](#api-surface-high-level)
- [Troubleshooting](#troubleshooting)

## What InfraBox Does

InfraBox helps teams answer practical pre-deploy questions:

- What is likely to fail in the next deployment?
- Which service is the highest risk right now?
- Where are CI/CD bottlenecks?
- How does infrastructure behave under stress simulations?
- What actions reduce risk fastest?

Core feature areas:

- Repository ingestion and analysis
- Pipeline parsing and stage metrics
- Dependency graph and technical debt insights
- Failure prediction and digital twin simulation
- Monitoring and incident-oriented operational views
- AI DevOps assistant endpoints for contextual guidance

## Repository Layout

Top-level folders of interest:

- `frontend/`: Primary app (client + Express API + Drizzle ORM)
- `backend/`: Secondary stack (Next.js frontend + standalone Express API + MongoDB)
- `api/[...path].js`: Vercel proxy function for forwarding `/api/*` to external backend base URL
- `vercel.json`: Vercel build/output config currently targeting `frontend/`
- `app/frontend/` and `backend/Frontend/frontend/`: Duplicated snapshots of the primary frontend code path

Recommended development target:

- Use `frontend/` unless you explicitly need to work on the `backend/` Next.js + Mongo stack.

## Architecture

Primary runtime (`frontend/`):

1. React/Vite client is served by Express in production.
2. Express exposes `/api/*` endpoints and legacy analysis routes.
3. Data access uses Drizzle ORM with PostgreSQL in production (and compatible local DB workflows).
4. Auth middleware supports Auth0 token verification with an optional local bypass for development.

Vercel routing:

- Static output comes from `frontend/dist/public`.
- Requests to `/api/*` can be proxied via `api/[...path].js` using `API_BASE_URL` or `BACKEND_API_URL` environment variables.

## Tech Stack

Primary stack (`frontend/`):

- Frontend: React 18, Vite 7, Wouter, TailwindCSS, shadcn/ui, Framer Motion, Recharts
- Backend: Express 5, TypeScript, Zod
- Data: Drizzle ORM, `pg`, `better-sqlite3`
- Build tooling: `tsx`, `esbuild`, `drizzle-kit`

Secondary stack (`backend/`):

- Frontend: Next.js App Router, React
- API server: Express (separate `server.js`)
- Data: MongoDB via Mongoose

## Quick Start (Primary App)

### 1. Prerequisites

- Node.js 20+ recommended (Node.js 18+ minimum)
- npm 9+
- PostgreSQL (for full backend features)

### 2. Install

```bash
cd frontend
npm install
```

### 3. Configure environment

Create `frontend/.env` with at least:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB_NAME
PORT=5000
NODE_ENV=development
```

Optional auth and AI keys are listed in [Environment Variables](#environment-variables).

### 4. Run dev server

```bash
npm run dev
```

Default app URL:

- `http://localhost:5000`

### 5. Build + run production

```bash
npm run build
npm run start
```

## Environment Variables

Important variables for `frontend/`:

Required for backend data access:

- `DATABASE_URL`: Postgres connection string

Common runtime:

- `PORT`: Server port (default `5000`)
- `NODE_ENV`: `development` or `production`
- `PG_SSL`: Set `true` when SSL is required for Postgres

Auth0-related:

- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_GITHUB_TOKEN_CLAIM` (optional custom claim key)
- `AUTH0_BYPASS` (`true` for local/dev bypass only)
- `DEV_AUTH0_SUB`
- `DEV_AUTH0_EMAIL`
- `DEV_AUTH0_NAME`
- `DEV_AUTH0_PICTURE`

AI/assistant integrations:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default: `gemini-2.0-flash`)
- `ELEVENLABS_API_KEY` (if TTS endpoints are used)
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_FALLBACK_VOICE_ID`
- `ELEVENLABS_MODEL_ID`

Client API base URL (if used by client service layer):

- `NEXT_PUBLIC_API_URL`

Vercel proxy vars (`api/[...path].js`):

- `API_BASE_URL` (preferred)
- `BACKEND_API_URL` (fallback)

Security note:

- Do not commit real secrets. Use `.env.local` or Vercel/CI secret managers for deployed environments.

## Scripts

Primary app scripts (`frontend/package.json`):

- `npm run dev`: Start development server with `tsx server/index.ts`
- `npm run build`: Build server + client bundle
- `npm run start`: Run production server (`dist/index.cjs`)
- `npm run check`: TypeScript check
- `npm run db:push`: Push Drizzle schema

Secondary stack scripts (`backend/package.json`):

- `npm run dev`: Next.js dev server
- `npm run build`: Next.js build
- `npm run start`: Next.js start
- `npm run server`: Express API server (`backend/server.js`)

## Deployment

Root `vercel.json` is configured to build from `frontend/`:

- `installCommand`: `cd frontend && npm install`
- `buildCommand`: `cd frontend && npm run build`
- `outputDirectory`: `frontend/dist/public`

Static rewrites send non-API routes to `index.html`, and API proxying can be handled with `api/[...path].js`.

Before deploying:

1. Set all required env vars in Vercel (especially `DATABASE_URL`, auth keys, AI keys as needed).
2. Set `API_BASE_URL` if using the proxy function for external API routing.
3. Confirm CORS and Auth0 callback URLs match deployed domains.

## Secondary Stack (backend/)

The `backend/` folder is a separate implementation track with:

- Next.js app under `backend/app/`
- Express API under `backend/server.js` and `backend/src/`
- MongoDB-backed models/services

Minimal run sequence:

```bash
cd backend
npm install
npm run server   # Express API (default port 3001)
npm run dev      # Next.js app (default port 3000)
```

This path is useful if you are actively working on the Mongo/service-heavy controllers in `backend/src/`.

## API Surface (High-Level)

Primary `frontend/` API includes routes for:

- Workspaces/users/repositories
- Pipelines and incidents
- Analysis and simulation workflows
- AI assistant chat
- Authenticated data retrieval and workspace-scoped operations

Secondary `backend/` API exposes route groups such as:

- `/api/workspaces`
- `/api/repos`
- `/api/analysis`
- `/api/pipeline`
- `/api/simulation`
- `/api/twin`
- `/api/predict`
- `/api/deployment`
- `/api/monitoring`
- `/api/dashboard`

For exact payloads and schemas, inspect route/controller files under:

- `frontend/server/routes.ts`
- `backend/src/routes/`
- `shared/schema.ts` (frontend stack contracts)

## Troubleshooting

`DATABASE_URL is required` on startup:

- Ensure `frontend/.env` exists and includes `DATABASE_URL`.
- Confirm the server loads `.env`/`.env.local` before DB init.

Auth failures (`401 Missing bearer token`):

- Validate Auth0 settings (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`).
- For local-only testing, set `AUTH0_BYPASS=true` and dev auth fields.

Vercel API proxy returns `Backend API base URL is not configured`:

- Set `API_BASE_URL` (or `BACKEND_API_URL`) in Vercel project environment variables.

Port/access issues on Windows:

- Primary app binds `localhost` on Windows. Use `http://localhost:5000` unless you changed `PORT`.

