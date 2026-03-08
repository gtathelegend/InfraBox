import { motion } from "framer-motion";
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
import { RippleButton } from "@/components/ui/ripple-button";
import { Slider } from "@/components/ui/slider";
import { useWorkspace } from "@/context/workspace-context";
import { apiRequest } from "@/lib/queryClient";

const profileOptions = [
  { label: "standard", users: 3000 },
  { label: "stress", users: 8000 },
  { label: "soak", users: 12000 },
] as const;

export default function SimulationsPage() {
  const { selectedRepo, dashboardData, refreshDashboard } = useWorkspace();
  const [profileIndex, setProfileIndex] = React.useState(0);
  const [isRunning, setIsRunning] = React.useState(false);
  const selectedProfile = profileOptions[profileIndex];

  React.useEffect(() => {
    if (!selectedRepo?.id) return;
    if (dashboardData?.repository.id === selectedRepo.id) return;
    refreshDashboard(selectedRepo.id).catch(() => {
      // Keep last data if refresh fails.
    });
  }, [dashboardData?.repository.id, refreshDashboard, selectedRepo?.id]);

  const simulationData = React.useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.simulationStages.map((stage) => ({
      step: stage.stage,
      cpu: stage.cpuUsage,
      memory: stage.memoryUsage,
      latency: stage.latencyMs,
      errors: stage.errorRate,
      traffic: stage.traffic,
    }));
  }, [dashboardData]);

  const runSimulation = async () => {
    if (!selectedRepo?.id || isRunning) return;
    setIsRunning(true);
    try {
      await apiRequest("POST", "/api/simulations/run", {
        repositoryId: selectedRepo.id,
        profile: selectedProfile.label,
      });
      await refreshDashboard(selectedRepo.id);
    } finally {
      setIsRunning(false);
    }
  };

  const peak = simulationData.find((item) => item.step === "Spike") ?? simulationData[1];
  const predictionHighlights = (dashboardData?.predictions ?? []).slice(0, 3);
  const simulationScores = [
    {
      label: "Failure Prediction",
      value: `${dashboardData?.metrics.failurePredictionScore ?? 0}/100`,
      hint: "Higher means higher failure risk",
      tone: "text-red-600",
    },
    {
      label: "Cost Prediction",
      value: `${dashboardData?.metrics.costPredictionScore ?? 0}/100`,
      hint: "Cost efficiency under simulated load",
      tone: "text-amber-600",
    },
    {
      label: "Deployment Score",
      value: `${dashboardData?.metrics.deploymentScore ?? 0}/100`,
      hint: dashboardData?.metrics.deploymentStatus ?? "Deployment readiness",
      tone: "text-primary",
    },
    {
      label: "Remediation Score",
      value: `${dashboardData?.metrics.remediationScore ?? 0}/100`,
      hint: "Recovery readiness after spike",
      tone: "text-emerald-600",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Simulation Lab</h1>
        <p className="mt-1 text-sm text-slate-600">
          Stress test infrastructure before deployment with dynamic traffic
          scenarios{selectedRepo ? ` for ${selectedRepo.fullName}` : ""}.
        </p>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader className="border-b border-slate-200/80">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Traffic Simulation</CardTitle>
            <RippleButton
              onClick={runSimulation}
              className="h-9 bg-primary px-3 text-xs text-white hover:bg-primary/90"
              disabled={!selectedRepo || isRunning}
            >
              {isRunning ? "Running..." : "Run Simulation"}
            </RippleButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Simulation profile</span>
              <span className="font-semibold text-slate-900">
                {selectedProfile.label.toUpperCase()} ({selectedProfile.users.toLocaleString()} users)
              </span>
            </div>
            <Slider
              value={[profileIndex]}
              max={profileOptions.length - 1}
              step={1}
              onValueChange={(value) => setProfileIndex(value[0] ?? 0)}
            />
            <div className="flex justify-between text-xs text-slate-500">
              {profileOptions.map((value) => (
                <span key={value.label}>{value.label}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {!dashboardData ? (
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5 text-sm text-slate-600">
            No simulation data available yet. Run full analysis or simulation.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {simulationScores.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card className="glass-card rounded-2xl">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                  {metric.label}
                </p>
                <p className={`text-2xl font-semibold ${metric.tone}`}>{metric.value}</p>
                <p className="text-xs text-slate-500">{metric.hint}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "CPU usage", value: `${peak?.cpu ?? 0}%`, tone: "text-primary" },
          { label: "Memory usage", value: `${peak?.memory ?? 0}%`, tone: "text-accent" },
          { label: "Latency", value: `${peak?.latency ?? 0}ms`, tone: "text-amber-600" },
          { label: "Error rate", value: `${peak?.errors ?? 0}%`, tone: "text-red-600" },
        ].map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card className="glass-card rounded-2xl">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                  {metric.label}
                </p>
                <p className={`text-2xl font-semibold ${metric.tone}`}>
                  {metric.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Simulation Metrics</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={
                  simulationData.length > 0
                    ? simulationData
                    : [{ step: "N/A", cpu: 0, memory: 0, latency: 0, errors: 0 }]
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="step" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Line dataKey="cpu" stroke="#2563EB" strokeWidth={2.2} />
                <Line dataKey="memory" stroke="#6366F1" strokeWidth={2.2} />
                <Line dataKey="latency" stroke="#F59E0B" strokeWidth={2.2} />
                <Line dataKey="errors" stroke="#EF4444" strokeWidth={2.2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Service Risk Detection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {predictionHighlights.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                No risk highlights yet.
              </div>
            ) : (
              predictionHighlights.map((prediction) => (
                <div
                  key={prediction.id}
                  className={`rounded-xl p-4 ${
                    prediction.severity === "high"
                      ? "border border-red-200 bg-red-50"
                      : prediction.severity === "medium"
                        ? "border border-amber-200 bg-amber-50"
                        : "border border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-700">
                    {prediction.service}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {prediction.riskType} risk at {prediction.probability}%.
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
