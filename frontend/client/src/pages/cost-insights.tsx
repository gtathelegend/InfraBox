import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";

export default function CostInsightsPage() {
  const { selectedRepo, dashboardData, refreshDashboard } = useWorkspace();

  React.useEffect(() => {
    if (!selectedRepo?.id) return;
    if (dashboardData?.repository.id === selectedRepo.id) return;
    refreshDashboard(selectedRepo.id).catch(() => {
      // Keep existing view if refresh fails.
    });
  }, [dashboardData?.repository.id, refreshDashboard, selectedRepo?.id]);

  const baseMonthlyCost = dashboardData?.costPrediction.monthlyCost ?? 0;
  const spikeCost = dashboardData?.costPrediction.spikeCost ?? 0;
  const costPredictionScore = dashboardData?.metrics.costPredictionScore ?? 0;

  const monthlyCostData = React.useMemo(() => {
    if (!dashboardData) return [];
    const trend = dashboardData.trend;
    if (trend.length === 0) return [];

    return trend.map((point, index) => {
      const ratio = trend.length > 1 ? index / (trend.length - 1) : 0;
      const compute = Math.round(baseMonthlyCost * (0.42 + ratio * 0.1));
      const storage = Math.round(baseMonthlyCost * (0.21 + ratio * 0.04));
      const bandwidth = Math.max(
        80,
        Math.round(baseMonthlyCost * (0.18 + point.errors * 0.03)),
      );
      return {
        month: point.hour,
        compute,
        storage,
        bandwidth,
      };
    });
  }, [baseMonthlyCost, dashboardData]);

  const serviceDistribution = React.useMemo(() => {
    if (!dashboardData) return [];
    const labels = dashboardData.predictions.map((item) => item.service);
    const fallback = ["API Gateway", "Payment Service", "Auth Service", "Database"];
    const services = (labels.length > 0 ? labels : fallback).slice(0, 5);
    const total = Math.max(baseMonthlyCost, 1);
    const weights = [0.29, 0.25, 0.18, 0.16, 0.12];
    return services.map((service, index) => ({
      service,
      cost: Math.round(total * (weights[index] ?? 0.1)),
    }));
  }, [baseMonthlyCost, dashboardData]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Cost Insights</h1>
        <p className="mt-1 text-sm text-slate-600">
          Understand spend behavior and predict monthly cloud costs
          {selectedRepo ? ` for ${selectedRepo.fullName}` : ""}.
        </p>
      </div>

      {!dashboardData ? (
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5 text-sm text-slate-600">
            No cost data yet. Run analysis to generate latest cost predictions.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Cloud Cost</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyCostData.length > 0 ? monthlyCostData : [{ month: "N/A", compute: 0, storage: 0, bandwidth: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="compute" stroke="#2563EB" strokeWidth={2.2} />
                <Line type="monotone" dataKey="storage" stroke="#6366F1" strokeWidth={2.2} />
                <Line
                  type="monotone"
                  dataKey="bandwidth"
                  stroke="#F59E0B"
                  strokeWidth={2.2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Prediction Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                Estimated monthly cost
              </p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                ${baseMonthlyCost.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-amber-700">
                Cost during traffic spike
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-800">
                ${spikeCost.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-primary">
                Cost Prediction Score
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {costPredictionScore}/100
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Efficiency score based on simulation traffic and spike pressure.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="mb-2 font-medium text-slate-900">Optimization suggestions</p>
              <p>
                1. Prioritize cost reduction in{" "}
                {serviceDistribution[0]?.service ?? "high-load services"}.
              </p>
              <p>2. Tune autoscaling cooldown to reduce spike over-provisioning.</p>
              <p>3. Add cache hit optimization on error-prone traffic windows.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Cost Distribution by Service</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serviceDistribution.length > 0 ? serviceDistribution : [{ service: "N/A", cost: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="service" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="cost" fill="#2563EB" radius={8} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
