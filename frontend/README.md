# Infrabox: Predict. Protect. Deploy.

Infrabox is a modern AI-powered DevOps intelligence platform UI that helps teams analyze repositories, simulate infrastructure behavior, predict failures, and improve deployment confidence before production release.

This repository contains the full-stack app:
- Frontend: React + Vite + TailwindCSS + shadcn/ui + Framer Motion
- Backend: Express + TypeScript
- Data: Drizzle ORM with SQLite in development and PostgreSQL in production

---

## 1. Product Overview

### Core Purpose
Infrabox is designed to answer:
- Will this deployment fail?
- Which service is at highest risk?
- What will traffic spikes cost?
- Where is the CI/CD bottleneck?

### Main Experience
- Premium pre-auth SaaS landing page
- Authentication screen
- Repository selection and analysis bootstrapping
- DevOps dashboard with predictive analytics
- Dedicated pages for architecture, simulation, predictions, deployments, and cost insights

---

## 2. User Flow (Current)

The app now enforces this sequence:

1. Landing page opens at `/`
2. User goes to login at `/auth`
3. On successful sign-in, user moves to `/connect-repository`
4. After repository analysis, user lands on `/dashboard`
5. User can then navigate to all private pages

Route protection behavior:
- If user is not authenticated and tries to access private routes, app redirects to `/auth`
- If authenticated but repository is not selected, app redirects to `/connect-repository`

---

## 3. UI & UX Breakdown

## 3.1 Pre-Auth Landing Page (`/`)

Modern light-theme SaaS website in Infrabox orange branding.

Sections:
- Sticky navbar with product links and CTA buttons
- Hero with DevOps AI glow/pulse visual
- Product visual preview block (pipeline + metrics + prediction snapshot)
- Features section (4 cards)
- How it works process flow
- Testimonials section
- CTA band
- Multi-column footer

Visual direction:
- Background: `#f9fafb`
- Orange gradient accents: `#ff7a18`, `#ff9a3c`, `#ffb347`
- White cards, soft shadows, rounded corners
- Motion-based reveals and hover interactions

---

## 3.2 Authentication (`/auth`)

Includes:
- OAuth-style buttons (GitHub / Google)
- Email/password form UI
- Branded side panel
- Smooth entrance animations

Current auth is UI-first demo logic:
- Successful sign-in sets local key: `infrabox.authenticated = true`
- Redirects to repository connection flow

---

## 3.3 Repository Selection (`/connect-repository`)

Capabilities:
- Search among predefined repositories
- Select repository
- Trigger analysis (`POST /analyze`)
- Show analysis progress state
- Store selected repository in workspace context
- Navigate to dashboard after analysis

---

## 3.4 Main Dashboard (`/dashboard`)

Key modules available:
- DevOps Pipeline Flow + timeline
- System status cards
- System usage meters (battery-style CPU/Memory)
- Cost prediction stack
- Latency and error chart
- Dependency graph preview
- Simulation metrics chart
- Failure prediction cards
- Recent alerts panel

Additional assistant UX:
- Bottom-center floating AI DevOps assistant input
- Expanding chat popup with minimize/close
- User/assistant chat bubbles + typing indicator

---

## 3.5 Other Product Pages

Available private routes include:
- `/repositories`
- `/architecture`
- `/pipeline`
- `/pipeline/:stage`
- `/simulations`
- `/predictions`
- `/predictions/:service`
- `/deployments`
- `/cost-insights`
- `/monitoring`
- `/ai-assistant`
- `/settings`

Aliases supported:
- `/pipelines` -> pipeline
- `/incidents` -> predictions
- `/cost` and `/costs` -> cost insights

---

## 4. Brand Assets

Infrabox logo usage is centralized via:
- `client/src/components/brand/infrabox-logo.tsx`

Current logo file:
- `client/public/infrabox-logo.png`

Also available:
- `client/public/infrabox-logo.svg` (vector fallback)

---

## 5. Tech Stack

Frontend:
- React 18
- Vite 7
- Wouter (routing)
- TailwindCSS 3
- shadcn/ui components
- Framer Motion
- Recharts
- React Flow (`@xyflow/react`)
- TanStack Query

Backend:
- Express 5
- TypeScript
- Zod validation

Data Layer:
- Drizzle ORM
- SQLite (`dev.db`) in development
- PostgreSQL in production (`DATABASE_URL`)

Build/Tooling:
- tsx
- esbuild
- PostCSS

---

## 6. Project Structure

Top-level:
- `client/` frontend application
- `server/` Express backend
- `shared/` shared schema and API contracts
- `script/` build scripts
- `dist/` production build output

Important frontend files:
- `client/src/App.tsx` routing + auth/repo gating
- `client/src/pages/landing.tsx` pre-auth SaaS landing page
- `client/src/pages/auth.tsx` login
- `client/src/pages/connect-repository.tsx` repo selection
- `client/src/pages/dashboard.tsx` main control center
- `client/src/components/layout/infrabox-shell.tsx` app layout shell
- `client/src/components/dashboard/ai-devops-assistant-dock.tsx` floating assistant

Important backend files:
- `server/index.ts` app bootstrap + middleware + serving
- `server/routes.ts` API handlers + seed data + demo AI response
- `server/storage.ts` DB access abstraction
- `server/db.ts` Drizzle DB initialization
- `shared/schema.ts` table definitions and TS types
- `shared/routes.ts` typed API contracts

---

## 7. API Overview

Primary API routes:
- `GET /api/users/me`
- `GET /api/workspaces`
- `GET /api/repositories`
- `POST /api/repositories`
- `GET /api/pipelines`
- `GET /api/pipelines/:id`
- `GET /api/incidents`
- `POST /api/incidents/:id/resolve`
- `POST /api/chat`

Additional analysis/demo endpoints:
- `POST /analyze`
- `GET /api/analysis`
- `GET /analysis`
- `GET /api/pipeline`
- `GET /api/simulation`
- `GET /simulation`

---

## 8. Local Development Setup

Requirements:
- Node.js 18+ (recommended Node 20)
- npm

Install:
```bash
npm install
```

Run development server:
```bash
npm run dev
```

Open:
- App: `http://localhost:5000`

Build:
```bash
npm run build
```

Run production build:
```bash
npm start
```

---

## 9. Database Notes

Development:
- Uses SQLite file `dev.db`
- Seed data is inserted automatically on startup if tables are empty

Production:
- Requires `DATABASE_URL`
- Uses PostgreSQL driver

Schema management:
```bash
npm run db:push
```

---

## 10. Scripts

- `npm run dev` -> Start backend + frontend in dev mode
- `npm run build` -> Build client and server bundles
- `npm run start` -> Run production server from `dist/`
- `npm run check` -> TypeScript type check
- `npm run db:push` -> Push Drizzle schema

---

## 11. Known Notes

- `npm run check` may show backend typing issues around `better-sqlite3` in some environments if type declarations are missing.
- UI authentication is currently demo/local-storage based, not a full server-auth implementation.

---

## 12. Future Improvements

- Replace demo auth with secure JWT/session auth
- Add real GitHub/GitLab repository integration
- Connect AI assistant responses to live telemetry and model backend
- Add end-to-end tests for route guards and critical user flows
- Add responsive snapshots and visual regression tests for dashboard modules

---

## 13. License

MIT

