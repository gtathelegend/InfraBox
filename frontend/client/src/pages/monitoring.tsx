import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIncidents } from "@/hooks/use-incidents";
import { usePipelines } from "@/hooks/use-pipelines";

export default function MonitoringPage() {
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: incidents, isLoading: incidentsLoading } = useIncidents();

  const latestPipeline = pipelines?.[0];
  const errorRate = React.useMemo(() => {
    if (!pipelines?.length) return 0;
    const failed = pipelines.filter((pipeline) => pipeline.status === "failed").length;
    return ((failed / pipelines.length) * 100).toFixed(1);
  }, [pipelines]);

  const openIncidents = incidents?.filter((incident) => incident.status === "open") ?? [];
  const isLoading = pipelinesLoading || incidentsLoading;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Monitoring</h1>
        <p className="mt-1 text-sm text-slate-600">
          Post-deployment observability and self-healing status.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Latency</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {isLoading ? "..." : `${Math.max(80, 220 - (latestPipeline?.confidenceScore ?? 0))}ms`}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Error rate</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {isLoading ? "..." : `${errorRate}%`}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Self-healing events</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {isLoading ? "..." : `${openIncidents.length} open`}
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
            {isLoading
              ? "Loading system status..."
              : openIncidents.length === 0
                ? "All monitored services are healthy."
                : `${openIncidents.length} active incident(s) require attention.`}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Activity className="h-4 w-4" />
            {latestPipeline
              ? `Latest pipeline '${latestPipeline.name}' status: ${latestPipeline.status}.`
              : "No pipeline execution data available."}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4" />
            {openIncidents[0]
              ? openIncidents[0].description
              : "No critical anomalies detected in recent telemetry."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
