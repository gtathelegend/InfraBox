import { motion } from "framer-motion";
import { AlertTriangle, Clock3, Play, ShieldAlert } from "lucide-react";
import * as React from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";
import { usePipelines } from "@/hooks/use-pipelines";
import pipelineService from "@services/pipelineService";

const statusTone: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

export default function PipelinePage() {
  const { selectedRepo } = useWorkspace();
  const { data: pipelines, isLoading } = usePipelines();
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeStage, setActiveStage] = React.useState(-1);
  const [graphNodes, setGraphNodes] = React.useState<Node[]>([]);
  const [graphEdges, setGraphEdges] = React.useState<Edge[]>([]);
  const [graphLoading, setGraphLoading] = React.useState(true);
  const [graphError, setGraphError] = React.useState<string | null>(null);

  const resolvedRepoId = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return (
      new URLSearchParams(window.location.search).get("repoId") ||
      window.localStorage.getItem("infrabox.repoId") ||
      selectedRepo?.name ||
      (import.meta.env.VITE_REPO_ID as string | undefined) ||
      ""
    );
  }, [selectedRepo?.name]);

  const pipelineStages = React.useMemo(() => {
    const latest = pipelines?.[0];
    if (!latest?.stages) return [];
    const parsed = Array.isArray(latest.stages)
      ? latest.stages
      : typeof latest.stages === "string"
        ? (() => {
            try {
              const value = JSON.parse(latest.stages) as string[];
              return Array.isArray(value) ? value : [];
            } catch {
              return latest.stages.split(",").map((stage) => stage.trim()).filter(Boolean);
            }
          })()
        : [];
    return parsed.map((stage) => ({ name: stage, time: "-", failRate: "-", status: "success" }));
  }, [pipelines]);

  React.useEffect(() => {
    async function fetchPipelineGraph() {
      if (!resolvedRepoId) {
        setGraphLoading(false);
        setGraphError("Missing repoId. Add ?repoId=<id> to URL or set infrabox.repoId.");
        return;
      }

      try {
        setGraphLoading(true);
        setGraphError(null);

        const graph = await pipelineService.getPipelineGraph(resolvedRepoId);
        const spacing = 210;
        const y = 120;

        const dynamicNodes: Node[] = graph.nodes.map((node, index) => ({
          id: node.id,
          data: { label: node.id },
          position: { x: index * spacing, y },
          style: {
            borderRadius: 14,
            padding: 8,
            border: "1px solid #bfdbfe",
            background: "#ffffff",
          },
        }));

        const dynamicEdges: Edge[] = graph.edges.map((edge, index) => ({
          id: `edge-${index}-${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: true,
        }));

        setGraphNodes(dynamicNodes);
        setGraphEdges(dynamicEdges);
      } catch {
        setGraphError("Failed to load pipeline graph.");
      } finally {
        setGraphLoading(false);
      }
    }

    void fetchPipelineGraph();
  }, [resolvedRepoId]);

  React.useEffect(() => {
    if (!isRunning) return;

    if (activeStage >= pipelineStages.length - 1) {
      const completeTimer = window.setTimeout(() => {
        setIsRunning(false);
      }, 800);

      return () => window.clearTimeout(completeTimer);
    }

    const timer = window.setTimeout(() => {
      setActiveStage((current) => current + 1);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [isRunning, activeStage]);

  const handleRun = () => {
    setActiveStage(-1);
    setIsRunning(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pipeline Visualizer</h1>
          <p className="mt-1 text-sm text-slate-600">
            Build to deploy flow with stage-level performance intelligence
            {selectedRepo ? ` for ${selectedRepo.fullName}.` : "."}
          </p>
        </div>
        <RippleButton
          className="bg-primary text-white hover:bg-primary/90"
          onClick={handleRun}
          disabled={isRunning}
        >
          <Play className="h-4 w-4" />
          {isRunning ? "Running..." : "Run Pipeline"}
        </RippleButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">CI/CD Stages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Loading pipeline stages...
              </div>
            ) : null}

            {!isLoading && pipelineStages.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                No pipeline stage data available.
              </div>
            ) : null}

            {pipelineStages.map((stage, index) => {
              const isCurrent = index === activeStage;
              const isComplete = index < activeStage;
              const status = isCurrent
                ? "warning"
                : isComplete
                  ? "success"
                  : stage.status;

              return (
                <motion.div
                  key={stage.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={`rounded-2xl border bg-white p-4 transition ${
                    isCurrent
                      ? "border-primary shadow-[0_0_0_1px_rgba(37,99,235,0.2)]"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          isCurrent
                            ? "bg-primary"
                            : isComplete
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                        }`}
                      />
                      <p className="font-medium text-slate-900">{stage.name}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        statusTone[status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {isCurrent ? "Running" : isComplete ? "Completed" : "Pending"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      Execution time: {stage.time || "n/a"}
                    </p>
                    <p>Failure rate: {stage.failRate || "n/a"}</p>
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">Pipeline Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-amber-700">
                Slowest stage
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-800">
                {pipelineStages[1]?.name ?? "n/a"}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-red-700">
                Failure probability
              </p>
              <p className="mt-1 text-sm font-semibold text-red-800">
                {pipelines?.[0]?.status === "failed" ? "High" : "Low"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="mb-2 font-medium text-slate-900">Run health summary</p>
              <p className="mb-1 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Security scan passed with medium warnings.
              </p>
              <p className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Test stage takes 39% of total pipeline runtime.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">Pipeline Graph</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px] p-0">
            {graphLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-600">
                Loading pipeline graph...
              </div>
            ) : graphError ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
                {graphError}
              </div>
            ) : graphNodes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-600">
                No graph data available.
              </div>
            ) : (
              <ReactFlow nodes={graphNodes} edges={graphEdges} fitView>
                <Background color="#dbeafe" gap={22} />
                <Controls showInteractive={false} />
              </ReactFlow>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
