import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import * as React from "react";
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
import monitoringService, { type SystemMetrics } from "@services/monitoringService";

type MetricPoint = {
  time: string;
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
  traffic: number;
  errorRate: number;
};

const HISTORY_LIMIT = 20;

function resolveWorkspaceId() {
  if (typeof window === "undefined") return "";
  return (
    new URLSearchParams(window.location.search).get("workspaceId") ||
    window.localStorage.getItem("infrabox.workspaceId") ||
    (import.meta.env.VITE_WORKSPACE_ID as string | undefined) ||
    ""
  );
}

function pointFromMetrics(metrics: SystemMetrics): MetricPoint {
  const now = metrics.timestamp ? new Date(metrics.timestamp) : new Date();
  return {
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    cpuUsage: Number(metrics.cpuUsage ?? 0),
    memoryUsage: Number(metrics.memoryUsage ?? 0),
    latency: Number(metrics.latency ?? 0),
    traffic: Number(metrics.traffic ?? 0),
    errorRate: Number(metrics.errorRate ?? 0),
  };
}

export default function MonitoringPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [latestMetrics, setLatestMetrics] = React.useState<SystemMetrics | null>(null);
  const [history, setHistory] = React.useState<MetricPoint[]>([]);

  React.useEffect(() => {
    const workspaceId = resolveWorkspaceId();
    let mounted = true;

    const fetchMetrics = async () => {
      try {
        if (mounted) {
          setError(null);
        }

        const metrics = await monitoringService.getSystemMetrics(workspaceId || undefined);
        if (!mounted) return;

        setLatestMetrics(metrics);
        setHistory((prev) => {
          const next = [...prev, pointFromMetrics(metrics)];
          return next.slice(-HISTORY_LIMIT);
        });
      } catch {
        if (mounted) {
          setError("Failed to load monitoring metrics");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchMetrics();
    const timer = window.setInterval(() => {
      void fetchMetrics();
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Monitoring</h1>
        <p className="mt-1 text-sm text-slate-600">
          Post-deployment observability and self-healing status.
        </p>
      </div>

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">CPU usage</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {loading ? "..." : `${latestMetrics?.cpuUsage ?? 0}%`}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Latency</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {loading ? "..." : `${latestMetrics?.latency ?? 0}ms`}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Error rate</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {loading ? "..." : `${((latestMetrics?.errorRate ?? 0) * 100).toFixed(2)}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">CPU Usage Graph</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="cpuUsage" stroke="#2563EB" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Memory Usage Graph</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="memoryUsage" stroke="#6366F1" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Latency Graph</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="latency" stroke="#F59E0B" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Traffic Graph</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="traffic" stroke="#0EA5A4" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            {loading
              ? "Loading system status..."
              : (latestMetrics?.errorRate ?? 0) < 0.05
                ? "All monitored services are healthy."
                : "Elevated error rate detected. Investigate affected services."}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Activity className="h-4 w-4" />
            {loading
              ? "Awaiting latest telemetry sample..."
              : `Current throughput: ${(latestMetrics?.traffic ?? 0).toLocaleString()} req/min.`}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4" />
            {loading
              ? "Analyzing anomalies..."
              : `Memory pressure is ${latestMetrics?.memoryUsage ?? 0}% with latency ${latestMetrics?.latency ?? 0}ms.`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
