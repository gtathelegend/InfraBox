import { motion } from "framer-motion";
import {
  Activity,
  Globe,
  HardDrive,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import {
  Background,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";

const architectureNodes: Node[] = [
  {
    id: "edge",
    position: { x: 0, y: 120 },
    data: { label: "Edge CDN" },
    style: { border: "1px solid #bfdbfe", borderRadius: 12 },
  },
  {
    id: "gateway",
    position: { x: 210, y: 120 },
    data: { label: "Ingress Gateway" },
    style: { border: "1px solid #bfdbfe", borderRadius: 12 },
  },
  {
    id: "cluster-a",
    position: { x: 440, y: 40 },
    data: { label: "Compute Cluster A" },
    style: { border: "1px solid #c7d2fe", borderRadius: 12 },
  },
  {
    id: "cluster-b",
    position: { x: 440, y: 200 },
    data: { label: "Compute Cluster B" },
    style: { border: "1px solid #fde68a", borderRadius: 12 },
  },
  {
    id: "postgres",
    position: { x: 690, y: 80 },
    data: { label: "PostgreSQL Primary" },
    style: { border: "1px solid #bbf7d0", borderRadius: 12 },
  },
  {
    id: "redis",
    position: { x: 690, y: 230 },
    data: { label: "Redis Cache" },
    style: { border: "1px solid #fbcfe8", borderRadius: 12 },
  },
];

const architectureEdges: Edge[] = [
  {
    id: "a1",
    source: "edge",
    target: "gateway",
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
  {
    id: "a2",
    source: "gateway",
    target: "cluster-a",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "a3",
    source: "gateway",
    target: "cluster-b",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "a4",
    source: "cluster-a",
    target: "postgres",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "a5",
    source: "cluster-b",
    target: "postgres",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "a6",
    source: "cluster-b",
    target: "redis",
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
];

const zoneCards: { title: string; detail: string; icon: LucideIcon }[] = [
  {
    title: "Global Edge",
    detail: "99.98% availability, median TTFB 46ms",
    icon: Globe,
  },
  {
    title: "Compute Plane",
    detail: "18 containers healthy across two clusters",
    icon: Server,
  },
  {
    title: "Data Plane",
    detail: "Primary + replica lag under 20ms",
    icon: HardDrive,
  },
  {
    title: "Security Posture",
    detail: "No critical findings in latest scan",
    icon: ShieldCheck,
  },
];

const tierBorder: Record<string, string> = {
  frontend: "1px solid #bfdbfe",
  gateway: "1px solid #c7d2fe",
  service: "1px solid #fecaca",
  data: "1px solid #bbf7d0",
};

export default function ArchitecturePage() {
  const { selectedRepo, dashboardData, refreshDashboard } = useWorkspace();

  React.useEffect(() => {
    if (!selectedRepo?.id) return;
    if (dashboardData?.repository.id === selectedRepo.id) return;
    refreshDashboard(selectedRepo.id).catch(() => {
      // Keep existing graph if refresh fails.
    });
  }, [dashboardData?.repository.id, refreshDashboard, selectedRepo?.id]);

  const flowNodes = React.useMemo<Node[]>(() => {
    if (!dashboardData) return architectureNodes;

    return dashboardData.dependencyGraph.nodes.map((node, index) => {
      const row = index < 3 ? 0 : 1;
      const col = index % 3;
      return {
        id: node.id,
        data: { label: node.label },
        position: { x: col * 250 + 20, y: row * 180 + 40 },
        style: {
          border: tierBorder[node.tier ?? "service"] ?? tierBorder.service,
          borderRadius: 12,
        },
      };
    });
  }, [dashboardData]);

  const flowEdges = React.useMemo<Edge[]>(() => {
    if (!dashboardData) return architectureEdges;
    return dashboardData.dependencyGraph.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: index % 2 === 0,
    }));
  }, [dashboardData]);

  const liveZoneCards = React.useMemo(() => {
    if (!dashboardData) return zoneCards;

    const databaseRisk = dashboardData.predictions.find((risk) =>
      /database|postgres/i.test(risk.service),
    );
    const hasHighAlert = dashboardData.alerts.some((alert) => alert.severity === "high");

    return [
      {
        title: "Global Edge",
        detail: `Latency ${dashboardData.metrics.latency}ms, error ${dashboardData.metrics.errorRate}%`,
        icon: Globe,
      },
      {
        title: "Compute Plane",
        detail: `CPU ${dashboardData.metrics.cpuUsage}% | Memory ${dashboardData.metrics.memoryUsage}%`,
        icon: Server,
      },
      {
        title: "Data Plane",
        detail: databaseRisk
          ? `${databaseRisk.service} risk ${databaseRisk.probability}%`
          : "Primary datastore stable in latest run",
        icon: HardDrive,
      },
      {
        title: "Security Posture",
        detail: hasHighAlert ? "High-severity alert open" : "No high-severity alerts",
        icon: ShieldCheck,
      },
    ] as const;
  }, [dashboardData]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Architecture</h1>
        <p className="mt-1 text-sm text-slate-600">
          Live digital twin of production service topology
          {selectedRepo ? ` for ${selectedRepo.fullName}` : ""}.
        </p>
      </div>

      {!dashboardData ? (
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5 text-sm text-slate-600">
            No architecture graph found yet. Run repository analysis first.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {liveZoneCards.map((zone, index) => (
          <motion.div
            key={zone.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <Card className="glass-card rounded-2xl">
              <CardContent className="space-y-2 p-5">
                <zone.icon className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-slate-900">{zone.title}</p>
                <p className="text-sm text-slate-600">{zone.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader className="border-b border-slate-200/80">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Infrastructure Graph
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[460px] p-0">
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
            <Background color="#dbeafe" gap={24} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </CardContent>
      </Card>
    </div>
  );
}
