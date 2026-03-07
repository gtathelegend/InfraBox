"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────
interface WorkspaceData {
  id: string;
  name: string;
  role: string;
  repositories: string[];
  pipelines: string[];
  simulations: string[];
  alerts: string[];
  deployments: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Placeholder data (used until /api/me is connected) ─────────────
const PLACEHOLDER_WORKSPACES: WorkspaceData[] = [
  {
    id: "ws_1",
    name: "My Workspace",
    role: "Owner",
    repositories: ["infrabox-core", "infrabox-cli", "deployment-scripts"],
    pipelines: ["CI/CD Main", "Staging Deploy", "Nightly Tests"],
    simulations: ["Load Test v2", "Chaos Monkey #14"],
    alerts: ["CPU > 90% on prod-us-east", "Disk usage warning"],
    deployments: ["v2.4.1 → prod", "v2.4.0 → staging"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── Section card component ─────────────────────────────────────────
function SectionCard({
  title,
  icon,
  items,
  emptyLabel,
  accentColor,
}: {
  title: string;
  icon: string;
  items: string[];
  emptyLabel: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 flex flex-col gap-3 hover:border-white/20 transition-all duration-300 hover:shadow-lg hover:shadow-black/20">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-base font-semibold text-gray-200">{title}</h3>
        <span
          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: accentColor + "22", color: accentColor }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors cursor-default"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Role badge ─────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    Owner: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "DevOps Engineer": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Developer: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    Viewer: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colorMap[role] || colorMap["Viewer"]}`}
    >
      {role}
    </span>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────
export default function DashboardClient() {
  const { user, isLoading } = useUser();
  const [workspaces] = useState<WorkspaceData[]>(PLACEHOLDER_WORKSPACES);
  const [activeWsIndex, setActiveWsIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">You need to sign in to access the dashboard.</p>
          <a
            href="/auth/login"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  const activeWs = workspaces[activeWsIndex];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold">
              IB
            </div>
            <span className="text-lg font-bold tracking-tight">InfraBox</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white/5 rounded-full pl-3 pr-1 py-1">
              <span className="text-sm text-gray-300 hidden sm:inline">
                {user.name}
              </span>
              {user.picture && (
                <img
                  src={user.picture as string}
                  alt={user.name as string}
                  className="w-8 h-8 rounded-full ring-2 ring-indigo-500/40"
                />
              )}
            </div>
            <a
              href="/auth/logout"
              className="text-sm text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Logout
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Workspace Selector ─────────────────────────────────── */}
        <section className="mb-8">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Workspace
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            {workspaces.map((ws, i) => (
              <button
                key={ws.id}
                onClick={() => setActiveWsIndex(i)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                  i === activeWsIndex
                    ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-lg shadow-indigo-500/10"
                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                }`}
              >
                {ws.name}
              </button>
            ))}
          </div>
        </section>

        {/* ── Workspace Header ───────────────────────────────────── */}
        {activeWs && (
          <>
            <div className="flex items-center gap-3 mb-8">
              <h1 className="text-2xl font-bold">{activeWs.name}</h1>
              <RoleBadge role={activeWs.role} />
            </div>

            {/* ── Dashboard Grid ───────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <SectionCard
                title="Repositories"
                icon="📦"
                items={activeWs.repositories}
                emptyLabel="No repositories connected yet"
                accentColor="#818cf8"
              />
              <SectionCard
                title="Pipelines"
                icon="🔁"
                items={activeWs.pipelines}
                emptyLabel="No pipelines configured"
                accentColor="#38bdf8"
              />
              <SectionCard
                title="Simulations"
                icon="🧪"
                items={activeWs.simulations}
                emptyLabel="No simulations run yet"
                accentColor="#a78bfa"
              />
              <SectionCard
                title="Alerts"
                icon="🔔"
                items={activeWs.alerts}
                emptyLabel="No active alerts"
                accentColor="#fb923c"
              />
              <SectionCard
                title="Deployments"
                icon="🚀"
                items={activeWs.deployments}
                emptyLabel="No deployments recorded"
                accentColor="#34d399"
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
