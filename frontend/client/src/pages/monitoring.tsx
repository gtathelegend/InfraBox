import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import type { MonitoringAlert, SimulationMetric, SimulationRun } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";
import { apiRequest } from "@/lib/queryClient";

type MonitoringResponse = {
  alerts: MonitoringAlert[];
  latest: { run: SimulationRun; metrics: SimulationMetric[] } | null;
};

export default function MonitoringPage() {
  const { selectedRepo } = useWorkspace();

  const { data, isLoading } = useQuery({
    queryKey: ["monitoring", selectedRepo?.id],
    enabled: Boolean(selectedRepo?.id),
    queryFn: async () => {
      if (!selectedRepo?.id) return null;
      const response = await apiRequest(
        "GET",
        `/api/monitoring/${encodeURIComponent(selectedRepo.id)}`,
      );
      return (await response.json()) as MonitoringResponse;
    },
  });

  const steady =
    data?.latest?.metrics.find((metric) => metric.stage === "Steady") ??
    data?.latest?.metrics[0] ??
    null;
  const highAlerts = data?.alerts.filter((alert) => alert.severity === "high").length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Monitoring</h1>
        <p className="mt-1 text-sm text-slate-600">
          Post-deployment observability and self-healing status
          {selectedRepo ? ` for ${selectedRepo.fullName}` : ""}.
        </p>
      </div>

      {isLoading ? (
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5 text-sm text-slate-600">
            Loading monitoring telemetry...
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Latency</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {steady ? `${steady.latencyMs}ms` : "--"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Error rate</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {steady ? `${steady.errorRate}%` : "--"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Self-healing events</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.alerts.length ?? 0} tracked
            </p>
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
            {highAlerts > 0
              ? `${highAlerts} high-severity alerts detected.`
              : "No high-severity monitoring alerts detected."}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Activity className="h-4 w-4" />
            {steady
              ? `CPU ${steady.cpuUsage}% and memory ${steady.memoryUsage}% on latest steady stage.`
              : "No recent simulation metrics available."}
          </div>
          {(data?.alerts ?? []).slice(0, 1).map((alert) => (
            <div
              key={alert.id}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <AlertTriangle className="h-4 w-4" />
              {alert.title}: {alert.message}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
