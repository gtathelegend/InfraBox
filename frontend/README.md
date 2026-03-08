# Infrabox

Predict. Protect. Deploy.

Infrabox is an AI-powered DevOps intelligence platform that analyzes connected repositories, simulates infrastructure behavior, predicts failures and cost spikes, computes deployment confidence, and provides an AI DevOps assistant for remediation guidance.

This project is now implemented as a working full-stack web app with real backend workflow wiring.

## Tech Stack

Frontend
- React 18 + Vite 7
- TailwindCSS + shadcn/ui
- Framer Motion
- Recharts
- React Flow (`@xyflow/react`)
- TanStack Query
- Auth0 React SDK (`@auth0/auth0-react`)

Backend
- Express 5 + TypeScript
- Drizzle ORM
- PostgreSQL (`pg`)
- Zod validation

External Integrations
- Auth0 (JWT auth)
- GitHub API (repository listing + codebase metadata fetch)
- Google Gemini API (`/api/ai/chat`)

---

## Product Flow

1. Landing page (`/`)
2. Auth0 login (`/auth`)
3. GitHub repository selection (`/connect-repository`)
4. Full analysis workflow
5. Dashboard (`/dashboard`)
6. Simulation, prediction, cost, deployment, monitoring pages
7. AI DevOps Assistant

---

## UI Overview

### 1. Landing Page
Path: `/`

Sections
- Sticky navbar (Product, Features, Architecture, Pricing, Docs)
- Hero with orange glow motion visual
- Product preview
- Features
- How it works
- Testimonials
- CTA
- Footer

Theme
- Light SaaS style
- Orange branding (`#ff7a18`, `#ff9a3c`, `#ffb347`)
- White cards, rounded corners, soft shadows

### 2. Auth Page
Path: `/auth`

- Real Auth0 login triggers
- GitHub OAuth button
- Google OAuth button
- Email/password (Auth0 DB connection flow)

### 3. Repository Connect
Path: `/connect-repository`

- Fetches repositories from `GET /api/github/repos`
- Search/filter repositories
- Connect selected repo via `POST /api/repositories/connect`
- Triggers full analysis via `POST /api/analysis/run`

### 4. Dashboard
Path: `/dashboard`

Modules
- Pipeline flow and timeline
- Status cards
- CPU/Memory battery usage meters
- Cost prediction cards
- Latency/Error chart
- Dependency graph preview (React Flow)
- Simulation metrics chart
- Failure prediction cards
- Recent alerts
- Bottom-center AI assistant dock + popup chat

### 5. Additional Product Pages
- `/repositories`
- `/architecture`
- `/pipeline`
- `/simulations`
- `/predictions`
- `/deployments`
- `/cost-insights`
- `/monitoring`
- `/incidents`
- `/settings`
- `/ai-assistant`

---

## Backend Architecture

### Auth Middleware
File: `server/auth.ts`

- `verifyAuth0Token()`
  - Validates Auth0 JWT using JWKS signature verification
  - Validates issuer, audience, expiration
- `ensureWorkspace()`
  - Upserts `users`
  - Creates/loads one workspace per user
- `getGitHubToken()`
  - Reads GitHub token from Auth0 custom claim or request header

### Workflow Engine
File: `server/routes.ts`

Analysis pipeline executed by `runWorkflow()`
1. Fetch repository tree from GitHub API
2. Detect technologies (Next.js, Node.js, Python, Docker, PostgreSQL, Redis)
3. Detect services
4. Build dependency graph payload
5. Detect CI/CD stages from pipeline files
6. Run traffic simulation (Warmup/Spike/Steady/Recovery)
7. Generate failure predictions
8. Generate cost prediction
9. Generate monitoring alerts/incidents

---

## Database Model (Drizzle)

Schema file: `shared/schema.ts`

Tables
- `users`
- `workspaces`
- `repositories`
- `analysis_runs`
- `simulation_runs`
- `simulation_metrics`
- `predictions`
- `cost_predictions`
- `deployments`
- `monitoring_alerts`
- `assistant_messages`
- `pipelines` (compatibility)
- `incidents` (compatibility)

Relationship model
- One user -> one workspace
- One workspace -> many repositories
- One repository -> many analysis/simulation/prediction/cost/deployment records

---

## API Map

Public
- `GET /api/health`

Authenticated
- `GET /api/auth/me`
- `GET /api/users/me`
- `GET /api/workspaces/current`
- `GET /api/github/repos`
- `GET /api/repositories`
- `POST /api/repositories/connect`
- `POST /api/analysis/run`
- `GET /api/analysis/:repositoryId/latest`
- `POST /api/simulations/run`
- `GET /api/simulations/:repositoryId/latest`
- `GET /api/predictions/:repositoryId/latest`
- `GET /api/costs/:repositoryId/latest`
- `GET /api/dashboard/:repositoryId`
- `POST /api/deploy`
- `GET /api/monitoring/:repositoryId`
- `POST /api/ai/chat`
- `GET /api/pipelines`
- `GET /api/pipelines/:id`
- `GET /api/incidents`
- `POST /api/incidents/:id/resolve`

Compatibility aliases
- `POST /analyze`
- `GET /api/analysis`
- `GET /api/pipeline`
- `GET /api/simulation`
- `POST /api/chat`

---

## Environment Variables

Backend
- `DATABASE_URL`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_BYPASS` (optional local bypass)
- `AUTH0_GITHUB_TOKEN_CLAIM` (optional, default claim fallback logic included)
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, default: `gemini-2.0-flash`)
- `PG_SSL` (optional)

Frontend (`Vite`)
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`

Optional deploy/integration values
- `GITHUB_CLIENT_ID`
- `GITHUB_SECRET`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`

---

## Local Development

1. Install dependencies
```bash
npm install
```

2. Configure environment
- Copy `.env.example` to `.env` and fill real values

3. Push schema to DB
```bash
npm run db:push
```

4. Start app
```bash
npm run dev
```

5. Type-check
```bash
npm run check
```

6. Production build
```bash
npm run build
```

---

## Auth0 Notes

Required in Auth0
- Application configured for SPA (frontend)
- API configured with audience matching `VITE_AUTH0_AUDIENCE` / `AUTH0_AUDIENCE`
- Allowed callback URL includes `/auth`
- Connections enabled: GitHub, Google, Username-Password-Authentication

GitHub repository listing requires a GitHub token available to backend.
Recommended: add a custom Auth0 claim containing GitHub token and map claim name via `AUTH0_GITHUB_TOKEN_CLAIM`.

---

## Deployment Target Suggestion

Frontend
- Vercel

Backend
- Render

Database
- Supabase PostgreSQL

Cache/queue (optional)
- Upstash Redis

---

## Verification Status

Validated in this codebase
- TypeScript check passes (`npm run check`)
- Production build passes (`npm run build`)
- Auth0 SDK integrated in frontend
- Auth0 JWT verification middleware active in backend
- Dashboard connected to live backend data endpoint
- AI assistant connected to backend API with Gemini fallback behavior

---

## Brand Asset

Logo files
- `client/public/infrabox-logo.png`
- `client/public/infrabox-logo.svg`

Logo component
- `client/src/components/brand/infrabox-logo.tsx`

---

## License

MIT
