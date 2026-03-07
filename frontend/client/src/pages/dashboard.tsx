import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CircleCheckBig,
  FolderGit2,
  Lightbulb,
  Network,
} from "lucide-react";
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
import { useLocation } from "wouter";

import { AiDevopsAssistantDock } from "@/components/dashboard/ai-devops-assistant-dock";
import { BatteryUsageMeter } from "@/components/dashboard/battery-usage-meter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";
import {
  alerts as fallbackAlerts,
  dashboardTrend as fallbackDashboardTrend,
  riskCards as fallbackRiskCards,
} from "@/lib/infrabox-data";

const panelClass = "rounded-xl border border-slate-200 bg-white shadow-sm";

const pipelineFlowItems = [
  { label: "Repository", path: "/repositories" },
  { label: "Codebase Analysis", path: "/architecture" },
  { label: "Pipeline", path: "/pipeline" },
  { label: "Simulation", path: "/simulations" },
  { label: "Failure Prediction", path: "/predictions" },
  { label: "Cost Prediction", path: "/cost-insights" },
  { label: "Deployment Score", path: "/deployments" },
  { label: "Remediation", path: "/predictions" },
  { label: "Deployment", path: "/deployments" },
];

const timelineItems = [
  "Repository",
  "Analysis",
  "Pipeline",
  "Simulation",
  "Prediction",
  "Deployment",
];

const dependencyNodes: Node[] = [
  {
    id: "frontend",
    data: { label: "Frontend" },
    position: { x: 0, y: 120 },
    style: { borderRadius: 14, padding: 8, border: "1px solid #bfdbfe" },
  },
  {
    id: "gateway",
    data: { label: "API Gateway" },
    position: { x: 220, y: 120 },
    style: { borderRadius: 14, padding: 8, border: "1px solid #bfdbfe" },
  },
  {
    id: "auth",
    data: { label: "Auth Service" },
    position: { x: 460, y: 20 },
    style: { borderRadius: 14, padding: 8, border: "1px solid #c7d2fe" },
  },
  {
    id: "payment",
    data: { label: "Payment Service" },
    position: { x: 460, y: 220 },
    style: { borderRadius: 14, padding: 8, border: "1px solid #fecaca" },
  },
  {
    id: "database",
    data: { label: "Database" },
    position: { x: 700, y: 70 },
    style: { borderRadius: 14, padding: 8, border: "1px solid #bbf7d0" },
  },
  {
    id: "cache",
    data: { label: "Cache" },
    position: { x: 700, y: 220 },
    style: { borderRadius: 14, padding: 8, border: "1px solid #fcd34d" },
  },
];

const dependencyEdges: Edge[] = [
  {
    id: "e1",
    source: "frontend",
    target: "gateway",
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
  {
    id: "e2",
    source: "gateway",
    target: "auth",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e3",
    source: "gateway",
    target: "payment",
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
  {
    id: "e4",
    source: "auth",
    target: "database",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e5",
    source: "payment",
    target: "database",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e6",
    source: "payment",
    target: "cache",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

const riskToneClass: Record<string, string> = {
  danger: "border-red-200 bg-red-100 text-red-700",
  warning: "border-amber-200 bg-amber-100 text-amber-700",
  success: "border-emerald-200 bg-emerald-100 text-emerald-700",
};

const alertToneClass: Record<string, string> = {
  warning: "border-amber-200 bg-amber-100 text-amber-700",
  danger: "border-red-200 bg-red-100 text-red-700",
  success: "border-emerald-200 bg-emerald-100 text-emerald-700",
};

const alertDetailsPath: Record<string, string> = {
  "Payment service memory pressure": "/predictions/payment-service",
  "Build cache miss spike": "/predictions/api-gateway",
  "Security scan baseline healthy": "/predictions/auth-service",
};

const toPredictionPath = (service: string) =>
  `/predictions/${service.toLowerCase().replace(/\s+/g, "-")}`;

const onKeyNavigate = (
  event: React.KeyboardEvent<HTMLDivElement>,
  callback: () => void,
) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
};

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { selectedRepo, metrics, dashboardData } = useWorkspace();

  const latencyTrend = React.useMemo(
    () =>
      dashboardData?.trend.map((point) => ({
        hour: point.hour,
        latency: point.latency,
        errors: point.errors,
      })) ?? fallbackDashboardTrend,
    [dashboardData],
  );

  const simulationData = React.useMemo(
    () =>
      dashboardData?.simulationStages.map((point) => ({
        step: point.stage,
        cpu: point.cpuUsage,
        memory: point.memoryUsage,
        latency: point.latencyMs,
        errors: point.errorRate,
      })) ?? [
        { step: "Warmup", cpu: 36, memory: 42, latency: 98, errors: 0.4 },
        { step: "Spike", cpu: 52, memory: 58, latency: 120, errors: 0.8 },
        { step: "Steady", cpu: 48, memory: 52, latency: 108, errors: 0.6 },
        { step: "Recovery", cpu: 42, memory: 46, latency: 96, errors: 0.5 },
      ],
    [dashboardData],
  );

  const latestUsage = {
    cpu: dashboardData?.metrics.cpuUsage ?? metrics.cpuUsage ?? 0,
    memory: dashboardData?.metrics.memoryUsage ?? metrics.memoryUsage ?? 0,
  };

  const riskCards = React.useMemo(
    () =>
      dashboardData?.predictions.map((risk) => ({
        title: `${risk.riskType} Risk`,
        probability: risk.probability,
        service: risk.service,
        fix: risk.suggestion,
        tone:
          risk.severity === "high" ? "danger" : risk.severity === "medium" ? "warning" : "success",
      })) ?? fallbackRiskCards,
    [dashboardData],
  );

  const alerts = React.useMemo(
    () =>
      dashboardData?.alerts.map((alert) => ({
        severity:
          alert.severity === "high"
            ? "danger"
            : alert.severity === "medium"
              ? "warning"
              : "success",
        title: alert.title,
        detail: alert.detail,
      })) ?? fallbackAlerts,
    [dashboardData],
  );

  const dependencyFlowNodes = React.useMemo<Node[]>(() => {
    if (!dashboardData) return dependencyNodes;

    return dashboardData.dependencyGraph.nodes.map((node, index) => {
      const row = index < 3 ? 0 : 1;
      const col = index % 3;
      return {
        id: node.id,
        data: { label: node.label },
        position: { x: col * 250 + 20, y: row * 180 + 40 },
        style: { borderRadius: 14, padding: 8, border: "1px solid #bfdbfe" },
      };
    });
  }, [dashboardData]);

  const dependencyFlowEdges = React.useMemo<Edge[]>(() => {
    if (!dashboardData) return dependencyEdges;

    return dashboardData.dependencyGraph.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: index % 2 === 0,
    }));
  }, [dashboardData]);

  const summaryCards = [
    {
      title: "Deployment Confidence Score",
      value: `${dashboardData?.metrics.deploymentScore ?? metrics.deploymentConfidenceScore} / 100`,
      detail: "Ready for production rollout",
      path: "/deployments",
      icon: CircleCheckBig,
    },
    {
      title: "Active Repositories",
      value: `${metrics.activeRepositories}`,
      detail: "Tracked in this workspace",
      path: "/repositories",
      icon: FolderGit2,
    },
    {
      title: "Simulation Status",
      value: metrics.simulationStatus,
      detail: "Latest load test execution state",
      path: "/simulations",
      icon: Activity,
    },
    {
      title: "Infrastructure Health",
      value: `${metrics.infrastructureHealth}%`,
      detail: "Aggregated system reliability score",
      path: "/predictions",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6 pb-40">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-slate-900">Infrabox DevOps Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete control center view
          {selectedRepo ? ` for ${selectedRepo.fullName}` : ""}.
        </p>
      </motion.div>

      <div className="grid grid-cols-12 gap-6">
        <Card className={`col-span-12 ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg">DevOps Pipeline Flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-2">
                {pipelineFlowItems.map((item, index) => (
                  <React.Fragment key={item.label}>
                    <button
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:scale-[1.02] hover:border-primary/35 hover:text-primary"
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
                Pipeline Timeline
              </p>
              <div className="relative">
                <div className="absolute left-0 top-[11px] h-1 w-full rounded bg-slate-200" />
                <motion.div
                  className="absolute left-0 top-[11px] h-1 rounded bg-primary"
                  initial={{ width: "8%" }}
                  animate={{ width: "95%" }}
                  transition={{ duration: 2.2, repeat: Infinity, repeatType: "reverse" }}
                />
                <div className="relative grid grid-cols-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
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

        <div className="col-span-12 grid grid-cols-12 gap-6">
          {summaryCards.map((card, index) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(card.path)}
              className="col-span-12 text-left sm:col-span-6 xl:col-span-3"
            >
              <Card
                className={`${panelClass} h-full transition-transform duration-200 hover:scale-[1.02]`}
              >
                <CardContent className="flex h-full items-center justify-between p-5">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                      {card.title}
                    </p>
                    <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
                    <p className="text-sm text-slate-600">{card.detail}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <card.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </motion.button>
          ))}
        </div>

        <div className="col-span-12 grid grid-cols-12 items-start gap-6">
          <Card className={`col-span-12 h-auto min-w-0 self-start md:col-span-5 ${panelClass}`}>
            <CardHeader>
              <CardTitle className="text-lg">System Usage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4">
              <button
                className="h-auto w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-transform duration-200 hover:scale-[1.02]"
                onClick={() => navigate("/simulations")}
              >
                <BatteryUsageMeter label="CPU Usage" value={latestUsage.cpu} />
              </button>

              <button
                className="h-auto w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-transform duration-200 hover:scale-[1.02]"
                onClick={() => navigate("/simulations")}
              >
                <BatteryUsageMeter label="Memory Usage" value={latestUsage.memory} />
              </button>
            </CardContent>
          </Card>

          <Card className={`col-span-12 h-auto self-start md:col-span-7 ${panelClass}`}>
            <CardHeader>
              <CardTitle className="text-lg">Cost Prediction</CardTitle>
            </CardHeader>
            <CardContent className="flex h-auto flex-col gap-4 p-4">
              <button
                className="h-auto rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-transform duration-200 hover:scale-[1.02]"
                onClick={() => navigate("/cost-insights")}
              >
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Estimated Monthly Cost
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  $
                  {(dashboardData?.costPrediction.monthlyCost ?? 2680).toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Current infrastructure usage estimate
                </p>
              </button>

              <button
                className="h-auto rounded-lg border border-amber-200 bg-amber-50 p-4 text-left shadow-sm transition-transform duration-200 hover:scale-[1.02]"
                onClick={() => navigate("/cost-insights")}
              >
                <p className="text-xs uppercase tracking-[0.12em] text-amber-700">
                  Cost During Traffic Spike
                </p>
                <p className="mt-1 text-3xl font-bold text-amber-800">
                  $
                  {(dashboardData?.costPrediction.spikeCost ?? 3420).toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-amber-700">
                  Projected cost during simulated peak traffic
                </p>
              </button>
            </CardContent>
          </Card>
        </div>

        <button
          className="col-span-12 min-w-0 text-left"
          onClick={() => navigate("/predictions")}
        >
          <Card
            className={`${panelClass} h-full transition-transform duration-200 hover:scale-[1.02]`}
          >
            <CardHeader>
              <CardTitle className="text-lg">Latency and Error Rate</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] min-w-0 p-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    unit="ms"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "#e2e8f0",
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="latency"
                    stroke="#F59E0B"
                    strokeWidth={2.4}
                    dot={false}
                    animationDuration={650}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="errors"
                    stroke="#EF4444"
                    strokeWidth={2.4}
                    dot={false}
                    animationDuration={700}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </button>

        <div className="col-span-12 min-w-0 md:col-span-6">
          <Card
            className={`${panelClass} h-full cursor-pointer transition-transform duration-200 hover:scale-[1.02]`}
            onClick={() => navigate("/architecture")}
            onKeyDown={(event) => onKeyNavigate(event, () => navigate("/architecture"))}
            role="button"
            tabIndex={0}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Network className="h-5 w-5 text-primary" />
                Dependency Graph Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] min-w-0 p-0">
              <ReactFlow
                nodes={dependencyFlowNodes}
                edges={dependencyFlowEdges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
              >
                <Background color="#e2e8f0" gap={22} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </CardContent>
          </Card>
        </div>

        <Card className={`col-span-12 min-w-0 md:col-span-6 ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg">Simulation Metrics</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simulationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="step" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e2e8f0",
                  }}
                />
                <Line dataKey="cpu" stroke="#2563EB" strokeWidth={2.2} />
                <Line dataKey="memory" stroke="#6366F1" strokeWidth={2.2} />
                <Line dataKey="latency" stroke="#F59E0B" strokeWidth={2.2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={`col-span-12 md:col-span-6 ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg">Failure Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 xl:grid-cols-2">
              {riskCards.map((risk) => (
                <button
                  key={risk.title}
                  className="rounded-xl border border-slate-200 bg-white text-left transition-transform duration-200 hover:scale-[1.02]"
                  onClick={() => navigate(toPredictionPath(risk.service))}
                >
                  <div className="space-y-3 border-b border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xl font-semibold text-slate-900">{risk.title}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          riskToneClass[risk.tone]
                        }`}
                      >
                        {risk.probability}% risk
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${risk.probability}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Affected service:
                      <span className="font-semibold text-slate-900">{risk.service}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p className="mb-1 flex items-center gap-2 font-medium text-slate-900">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        Suggested fix
                      </p>
                      <p>{risk.fix}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={`col-span-12 md:col-span-6 ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alertItem) => (
              <button
                key={alertItem.title}
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-transform duration-200 hover:scale-[1.02]"
                onClick={() =>
                  navigate(alertDetailsPath[alertItem.title] ?? "/predictions")
                }
              >
                <div>
                  <p className="font-medium text-slate-900">{alertItem.title}</p>
                  <p className="text-sm text-slate-600">{alertItem.detail}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    alertToneClass[alertItem.severity]
                  }`}
                >
                  {alertItem.severity}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <AiDevopsAssistantDock />
    </div>
  );
}
