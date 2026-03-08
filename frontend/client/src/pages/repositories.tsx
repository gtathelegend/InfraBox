import { motion } from "framer-motion";
import { Database, FileCode2, GitBranch, Workflow } from "lucide-react";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { AnalysisRun } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";
import { apiRequest } from "@/lib/queryClient";

const nodes: Node[] = [
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

const edges: Edge[] = [
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

export default function RepositoriesPage() {
  const { selectedRepo, dashboardData, refreshDashboard } = useWorkspace();
  const [activeNodeId, setActiveNodeId] = React.useState("payment");

  React.useEffect(() => {
    if (!selectedRepo?.id) return;
    if (dashboardData?.repository.id === selectedRepo.id) return;
    refreshDashboard(selectedRepo.id).catch(() => {
      // Keep current render if refresh fails.
    });
  }, [dashboardData?.repository.id, refreshDashboard, selectedRepo?.id]);

  const { data: latestAnalysis } = useQuery({
    queryKey: ["analysis-latest", selectedRepo?.id],
    enabled: Boolean(selectedRepo?.id),
    queryFn: async () => {
      if (!selectedRepo?.id) return null;
      try {
        const response = await apiRequest(
          "GET",
          `/api/analysis/${encodeURIComponent(selectedRepo.id)}/latest`,
        );
        return (await response.json()) as AnalysisRun;
      } catch {
        return null;
      }
    },
  });

  const dynamicNodes = React.useMemo<Node[]>(() => {
    if (!dashboardData?.dependencyGraph.nodes?.length) return nodes;
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
  }, [dashboardData?.dependencyGraph.nodes]);

  const dynamicEdges = React.useMemo<Edge[]>(() => {
    if (!dashboardData?.dependencyGraph.edges?.length) return edges;
    return dashboardData.dependencyGraph.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: index % 2 === 0,
    }));
  }, [dashboardData?.dependencyGraph.edges]);

  React.useEffect(() => {
    const firstNodeId = dynamicNodes[0]?.id;
    if (firstNodeId) {
      setActiveNodeId(firstNodeId);
    }
  }, [dynamicNodes]);

  const repositoryMeta = React.useMemo(
    () => [
      {
        label: "Framework detected",
        value: latestAnalysis?.detectedTechnologies?.[0] ?? "Unknown",
        icon: FileCode2,
      },
      {
        label: "Technologies",
        value: latestAnalysis?.detectedTechnologies?.slice(0, 2).join(", ") ?? "Not analyzed",
        icon: FileCode2,
      },
      {
        label: "Database",
        value:
          latestAnalysis?.detectedTechnologies?.find((tech) => /postgres|mysql|mongo/i.test(tech)) ??
          "Unknown",
        icon: Database,
      },
      {
        label: "CI/CD stages",
        value: `${dashboardData?.pipelineStages.length ?? 0} detected`,
        icon: Workflow,
      },
    ],
    [dashboardData?.pipelineStages.length, latestAnalysis?.detectedTechnologies],
  );

  const activeNodeLabel =
    dynamicNodes.find((node) => node.id === activeNodeId)?.data?.label?.toString() ?? activeNodeId;
  const matchingRisk = dashboardData?.predictions.find(
    (risk) =>
      risk.service.toLowerCase() === activeNodeLabel.toLowerCase() ||
      risk.service.toLowerCase().includes(activeNodeLabel.toLowerCase()),
  );
  const activeDetail = {
    owner: `${activeNodeLabel} Team`,
    risk:
      matchingRisk?.severity === "high"
        ? "High"
        : matchingRisk?.severity === "medium"
          ? "Medium"
          : "Low",
    notes:
      matchingRisk?.suggestion ??
      "No critical issue detected for this service in latest analysis.",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Connected Repository</h1>
        <p className="mt-1 text-sm text-slate-600">
          {selectedRepo
            ? `${selectedRepo.fullName} on branch ${selectedRepo.branch}`
            : "No repository selected. Connect one from the repository picker."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {repositoryMeta.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="glass-card rounded-2xl">
              <CardContent className="space-y-2 p-5">
                <item.icon className="h-4 w-4 text-primary" />
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                  {item.label}
                </p>
                <p className="text-lg font-semibold text-slate-900">{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">Dependency Graph</CardTitle>
          </CardHeader>
          <CardContent className="h-[430px] p-0">
            <ReactFlow
              nodes={dynamicNodes}
              edges={dynamicEdges}
              fitView
              onNodeMouseEnter={(_, node) => setActiveNodeId(node.id)}
            >
              <Background color="#dbeafe" gap={24} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">Service Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                Selected Service
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {activeNodeLabel}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Owner</p>
              <p className="text-sm font-medium text-slate-800">{activeDetail.owner}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Risk</p>
              <p
                className={`text-sm font-semibold ${
                  activeDetail.risk === "High"
                    ? "text-red-600"
                    : activeDetail.risk === "Medium"
                      ? "text-amber-600"
                      : "text-emerald-600"
                }`}
              >
                {activeDetail.risk}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Notes</p>
              <p className="text-sm text-slate-700">{activeDetail.notes}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-700">
          <GitBranch className="h-4 w-4 text-primary" />
          Hover a service in the graph to inspect ownership, risk probability,
          and remediation context.
        </CardContent>
      </Card>
    </div>
  );
}
