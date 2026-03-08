import { motion } from "framer-motion";
import { AlertTriangle, Clock3, Play, ShieldAlert } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";

const statusTone: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

export default function PipelinePage() {
  const { selectedRepo, dashboardData, refreshDashboard, runFullAnalysis, isAnalyzing } =
    useWorkspace();

  React.useEffect(() => {
    if (!selectedRepo?.id) return;
    if (dashboardData?.repository.id === selectedRepo.id) return;
    refreshDashboard(selectedRepo.id).catch(() => {
      // Keep previous data if refresh fails.
    });
  }, [dashboardData?.repository.id, refreshDashboard, selectedRepo?.id]);

  const pipelineStages = dashboardData?.pipelineStages ?? [];
  const runningStageIndex = pipelineStages.findIndex((stage) => stage.status === "running");

  const handleRun = async () => {
    if (!selectedRepo?.id) return;
    await runFullAnalysis({
      withModal: false,
      repositoryId: selectedRepo.id,
      branch: selectedRepo.branch,
    });
  };

  const slowestStage = pipelineStages
    .slice()
    .sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))[0];
  const failureProbability = pipelineStages.length
    ? Math.round(
        pipelineStages.reduce((sum, stage) => sum + (stage.failRate ?? 0), 0) /
          pipelineStages.length,
      )
    : null;

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
          disabled={isAnalyzing || !selectedRepo}
        >
          <Play className="h-4 w-4" />
          {isAnalyzing ? "Running..." : "Run Pipeline"}
        </RippleButton>
      </div>

      {pipelineStages.length === 0 ? (
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5 text-sm text-slate-600">
            No pipeline stage data available yet. Run repository analysis to generate stages.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">CI/CD Stages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {pipelineStages.map((stage, index) => {
              const stageStatus =
                stage.status === "running"
                  ? "warning"
                  : stage.status === "failed"
                    ? "danger"
                    : stage.status === "pending"
                      ? "warning"
                      : "success";
              const isCurrent = runningStageIndex >= 0 ? index === runningStageIndex : false;
              const isComplete =
                runningStageIndex >= 0
                  ? index < runningStageIndex
                  : stage.status === "success";

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
                        statusTone[stageStatus] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {isCurrent ? "Running" : isComplete ? "Completed" : "Pending"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      Execution time: {stage.durationSec ? `${stage.durationSec}s` : "N/A"}
                    </p>
                    <p>Failure rate: {stage.failRate !== undefined ? `${stage.failRate}%` : "N/A"}</p>
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
                {slowestStage
                  ? `${slowestStage.name} - ${slowestStage.durationSec ?? 0}s`
                  : "N/A"}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-red-700">
                Failure probability
              </p>
              <p className="mt-1 text-sm font-semibold text-red-800">
                {failureProbability !== null ? `${failureProbability}% (stage average)` : "N/A"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="mb-2 font-medium text-slate-900">Run health summary</p>
              <p className="mb-1 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Deployment status: {dashboardData?.metrics.deploymentStatus ?? "Unknown"}.
              </p>
              <p className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Deployment score: {dashboardData?.metrics.deploymentScore ?? 0}/100.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
