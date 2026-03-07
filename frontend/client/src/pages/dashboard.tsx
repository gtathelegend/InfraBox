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
import dashboardService, {
  type DashboardApiPayload,
  type DeploymentHistoryItem,
} from "@services/dashboardService";

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

function formatHour(value: string | undefined) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function calcHealth(payload: DashboardApiPayload) {
  const highAlerts = payload.alerts.filter((item) => item.severity === "high").length;
  const mediumAlerts = payload.alerts.filter((item) => item.severity === "medium").length;
  return Math.max(35, 100 - highAlerts * 12 - mediumAlerts * 6);
}

function toDeploymentLabel(item: DeploymentHistoryItem) {
  const status = item.deploymentStatus ?? "unknown";
  const env = item.targetEnvironment ?? "env";
  return `${status} (${env})`;
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { selectedRepo } = useWorkspace();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dashboardData, setDashboardData] = React.useState<DashboardApiPayload>({
    repositories: [],
    pipelines: [],
    deploymentHistory: [],
    overview: null,
    systemMetrics: null,
    alerts: [],
  });

  React.useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError(null);

        const workspaceId =
          (typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("workspaceId")) ||
          (typeof window !== "undefined" ? window.localStorage.getItem("infrabox.workspaceId") : null) ||
          (import.meta.env.VITE_WORKSPACE_ID as string | undefined);

        const payload = await dashboardService.getDashboardData({ workspaceId });
        setDashboardData(payload);
      } catch {
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    void fetchDashboardData();
  }, []);

  const dashboardTrend = React.useMemo(() => {
    const cpuPoints = dashboardData.overview?.metrics?.cpuUsageGraph ?? [];
    const memoryPoints = dashboardData.overview?.metrics?.memoryUsageGraph ?? [];
    const latencyPoints = dashboardData.overview?.metrics?.latencyTrends ?? [];
    const errorPoints = dashboardData.overview?.metrics?.errorRateTrends ?? [];

    if (!cpuPoints.length) {
      return dashboardData.pipelines.slice(-7).map((pipeline) => ({
        hour: formatHour(pipeline.createdAt),
        cpu: Math.max(25, 100 - Number(pipeline.confidenceScore ?? 0)),
        memory: Math.max(30, Math.round(Number(pipeline.costPrediction ?? 0) / 10)),
        latency: Math.max(60, 220 - Number(pipeline.confidenceScore ?? 0)),
        errors: pipeline.status === "failed" ? 1.8 : 0.5,
      }));
    }

    return cpuPoints.map((point, index) => ({
      hour: formatHour(point.timestamp),
      cpu: Number(point.value ?? 0),
      memory: Number(memoryPoints[index]?.value ?? 0),
      latency: Number(latencyPoints[index]?.value ?? 0),
      errors: Number(errorPoints[index]?.value ?? 0),
    }));
  }, [dashboardData.overview?.metrics, dashboardData.pipelines]);

  const deploymentConfidence = React.useMemo(() => {
    if (!dashboardData.pipelines.length) return 0;
    const values = dashboardData.pipelines
      .map((pipeline) => Number(pipeline.confidenceScore ?? 0))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [dashboardData.pipelines]);

  const summaryCards = [
    {
      title: "Deployment Confidence Score",
      subtitle: `${deploymentConfidence} / 100`,
      detail: deploymentConfidence >= 70 ? "SAFE TO DEPLOY" : "REQUIRES REVIEW",
      path: "/deployments",
      icon: CircleCheckBig,
    },
    {
      title: "Active Repositories",
      subtitle: `${dashboardData.repositories.length}`,
      detail: "Repository Integration active",
      path: "/repositories",
      icon: FolderGit2,
    },
    {
      title: "Simulation Status",
      subtitle: dashboardData.systemMetrics ? "Live" : "Unavailable",
      detail: "Latest infrastructure simulation",
      path: "/simulations",
      icon: Activity,
    },
    {
      title: "Infrastructure Health",
      subtitle: `${calcHealth(dashboardData)}%`,
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

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

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

      {loading ? (
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
                      <p className="text-2xl font-semibold text-slate-900">{card.subtitle}</p>
                      <p className="text-sm text-slate-600">{card.detail}</p>
                    </div>
                    {card.title === "Deployment Confidence Score" ? (
                      <ConfidenceRing score={deploymentConfidence} />
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
                      <Line type="monotone" dataKey="cpu" stroke="#2563EB" strokeWidth={2.3} dot={false} />
                      <Line type="monotone" dataKey="memory" stroke="#6366F1" strokeWidth={2.3} dot={false} />
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
                      <Line type="monotone" dataKey="latency" stroke="#F59E0B" strokeWidth={2.3} dot={false} />
                      <Line type="monotone" dataKey="errors" stroke="#EF4444" strokeWidth={2.3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboardData.alerts.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    No active alerts.
                  </div>
                ) : (
                  dashboardData.alerts.slice(0, 3).map((alert, index) => (
                    <div
                      key={`${alert.type ?? "alert"}-${index}`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <p className="text-sm font-medium text-slate-900">{alert.message ?? "Alert"}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
                        {alert.severity ?? "unknown"}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Deployment History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboardData.deploymentHistory.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    No deployment history available.
                  </div>
                ) : (
                  dashboardData.deploymentHistory.slice(0, 3).map((deployment, index) => (
                    <div
                      key={deployment.deploymentId ?? deployment._id ?? String(index)}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <p className="text-sm font-medium text-slate-900">{toDeploymentLabel(deployment)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatHour(deployment.startedAt)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
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
