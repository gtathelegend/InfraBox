import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MonitoringPage() {
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
            <p className="mt-1 text-2xl font-semibold text-slate-900">124ms</p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Error rate</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">0.8%</p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Self-healing events</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">3 today</p>
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
            Service mesh healthy across all regions.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Activity className="h-4 w-4" />
            CPU burst detected in payment worker pool, autoscaling triggered.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4" />
            One retry spike observed in recommendation-service at 14:21.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
