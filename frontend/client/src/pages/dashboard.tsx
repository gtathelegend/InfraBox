import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CircleCheckBig,
  FolderGit2,
  GitBranch,
} from "lucide-react";
import * as React from "react";
import { useLocation } from "wouter";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/context/workspace-context";
import { dashboardTrend } from "@/lib/infrabox-data";

function ConfidenceRing({ score }: { score: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const progress = ((100 - score) / 100) * circumference;

  return (
    <div className="relative h-20 w-20">
      <svg className="h-20 w-20 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="rgba(148,163,184,0.25)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="rgb(37,99,235)"
          strokeLinecap="round"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900">
        {score}
      </div>
    </div>
  );
}

const pipelineFlowItems = [
  { label: "Repository", path: "/repositories" },
  { label: "Codebase Analysis", path: "/architecture" },
  { label: "Pipeline", path: "/pipeline" },
  { label: "Simulation", path: "/simulations" },
  { label: "Failure Prediction", path: "/predictions" },
  { label: "Cost Prediction", path: "/cost" },
  { label: "Deployment Score", path: "/deployments" },
  { label: "Remediation", path: "/predictions" },
  { label: "Deployment", path: "/deployments" },
  { label: "Monitoring", path: "/monitoring" },
];

const timelineItems = [
  "Repo",
  "Code Analysis",
  "Pipeline",
  "Simulation",
  "Prediction",
  "Deployment",
];

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { selectedRepo, metrics } = useWorkspace();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 750);
    return () => window.clearTimeout(timer);
  }, []);

  const summaryCards = [
    {
      title: "Deployment Confidence Score",
      subtitle: `${metrics.deploymentConfidenceScore} / 100`,
      detail: "SAFE TO DEPLOY",
      path: "/deployments",
      icon: CircleCheckBig,
    },
    {
      title: "Active Repositories",
      subtitle: `${metrics.activeRepositories}`,
      detail: "Repository Integration active",
      path: "/repositories",
      icon: FolderGit2,
    },
    {
      title: "Simulation Status",
      subtitle: metrics.simulationStatus,
      detail: "Latest infrastructure simulation",
      path: "/simulations",
      icon: Activity,
    },
    {
      title: "Infrastructure Health",
      subtitle: `${metrics.infrastructureHealth}%`,
      detail: "Failure Prediction confidence",
      path: "/predictions",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          {selectedRepo
            ? `Analysis view for ${selectedRepo.fullName}`
            : "Real-time operational snapshot for your DevOps workspace."}
        </p>
      </motion.div>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Pipeline Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2">
              {pipelineFlowItems.map((item, index) => (
                <React.Fragment key={item.label}>
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-primary/35 hover:text-primary"
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </button>
                  {index < pipelineFlowItems.length - 1 ? (
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  ) : null}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.1em] text-slate-500">
              DevOps Pipeline Timeline
            </p>
            <div className="relative">
              <div className="absolute left-0 top-[11px] h-1 w-full rounded bg-slate-200" />
              <motion.div
                className="absolute left-0 top-[11px] h-1 rounded bg-primary"
                initial={{ width: "10%" }}
                animate={{ width: "95%" }}
                transition={{ duration: 2.2, repeat: Infinity, repeatType: "reverse" }}
              />
              <div className="relative flex justify-between">
                {timelineItems.map((item) => (
                  <div key={item} className="flex flex-col items-center gap-1">
                    <span className="h-6 w-6 rounded-full border-2 border-primary bg-white" />
                    <span className="text-xs text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-[300px] rounded-2xl" />
            <Skeleton className="h-[300px] rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card, index) => (
              <motion.button
                key={card.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => navigate(card.path)}
                className="text-left"
              >
                <Card className="glass-card h-full rounded-2xl transition hover:-translate-y-1">
                  <CardContent className="flex h-full items-center justify-between p-5">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                        {card.title}
                      </p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {card.subtitle}
                      </p>
                      <p className="text-sm text-slate-600">{card.detail}</p>
                    </div>
                    {card.title === "Deployment Confidence Score" ? (
                      <ConfidenceRing score={metrics.deploymentConfidenceScore} />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <card.icon className="h-5 w-5" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <button className="text-left" onClick={() => navigate("/simulations")}>
              <Card className="glass-card rounded-2xl transition hover:border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg">CPU and Memory Usage</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="cpu"
                        stroke="#2563EB"
                        strokeWidth={2.3}
                        dot={false}
                        isAnimationActive
                      />
                      <Line
                        type="monotone"
                        dataKey="memory"
                        stroke="#6366F1"
                        strokeWidth={2.3}
                        dot={false}
                        isAnimationActive
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </button>

            <button className="text-left" onClick={() => navigate("/predictions")}>
              <Card className="glass-card rounded-2xl transition hover:border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg">Latency and Error Rate</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="#F59E0B"
                        strokeWidth={2.3}
                        dot={false}
                        isAnimationActive
                      />
                      <Line
                        type="monotone"
                        dataKey="errors"
                        stroke="#EF4444"
                        strokeWidth={2.3}
                        dot={false}
                        isAnimationActive
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </button>
          </div>

          <Card className="glass-card rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300"
                onClick={() => navigate("/predictions/payment-service")}
              >
                <div>
                  <p className="font-medium text-slate-900">Payment service memory pressure</p>
                  <p className="text-sm text-slate-600">
                    Predicted memory exhaustion during 10k concurrent users.
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
                  danger
                </span>
              </button>

              <button
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300"
                onClick={() => navigate("/pipeline/build-stage")}
              >
                <div>
                  <p className="font-medium text-slate-900">Build cache miss spike</p>
                  <p className="text-sm text-slate-600">
                    Cache hit ratio dropped causing slower build completion.
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-600">
                  warning
                </span>
              </button>
            </CardContent>
          </Card>
        </>
      )}

      {selectedRepo ? (
        <Card className="glass-card rounded-2xl">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-slate-700">
            <GitBranch className="h-4 w-4 text-primary" />
            Active repository context: <span className="font-semibold">{selectedRepo.fullName}</span>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
