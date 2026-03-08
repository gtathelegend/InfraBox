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
import { Slider } from "@/components/ui/slider";
import { useWorkspace } from "@/context/workspace-context";
import { buildSimulationSeries, simulationLoads } from "@/lib/infrabox-data";

export default function SimulationsPage() {
  const { selectedRepo } = useWorkspace();
  const [loadIndex, setLoadIndex] = React.useState(1);
  const selectedUsers = simulationLoads[loadIndex];

  const simulationData = React.useMemo(
    () => buildSimulationSeries(selectedUsers),
    [selectedUsers],
  );

  const peak = simulationData[1];

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
          <CardTitle className="text-lg">Traffic Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Concurrent users</span>
              <span className="font-semibold text-slate-900">
                {selectedUsers.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[loadIndex]}
              max={simulationLoads.length - 1}
              step={1}
              onValueChange={(value) => setLoadIndex(value[0] ?? 0)}
            />
            <div className="flex justify-between text-xs text-slate-500">
              {simulationLoads.map((value) => (
                <span key={value}>{value.toLocaleString()}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "CPU usage", value: `${peak.cpu}%`, tone: "text-primary" },
          { label: "Memory usage", value: `${peak.memory}%`, tone: "text-accent" },
          { label: "Latency", value: `${peak.latency}ms`, tone: "text-amber-600" },
          { label: "Error rate", value: `${peak.errors}%`, tone: "text-red-600" },
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
              <LineChart data={simulationData}>
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
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-red-700">
                Payment Service
              </p>
              <p className="mt-1 text-sm font-semibold text-red-800">
                Memory spike predicted under 10k users.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-amber-700">
                API Gateway
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-800">
                Latency degrades above 5k concurrent requests.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-emerald-700">
                Auth Service
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-800">
                Stable through all simulated scenarios.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
