import { AlertTriangle, Cpu, HardDrive, Workflow } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";

function parsePercent(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export default function DashboardPage() {
  const { latestAnalysis, runFullAnalysis, isAnalyzing, selectedRepo } = useWorkspace();

  if (!latestAnalysis) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Run Analysis</h1>
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-slate-700">
              No analysis data is available yet. Complete repository + infrastructure onboarding and run the AI analysis.
            </p>
            <RippleButton
              className="bg-primary text-white hover:bg-primary/90"
              onClick={() => {
                void runFullAnalysis();
              }}
              disabled={!selectedRepo || isAnalyzing}
            >
              {isAnalyzing ? "Running..." : "Run Analysis"}
            </RippleButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  const highestLoad = [...latestAnalysis.trafficSimulation]
    .sort((a, b) => b.users - a.users)
    .at(0);
  const cpuUsage = parsePercent(highestLoad?.cpuUsage);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Analysis Results Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Repository: {selectedRepo?.fullName} | Deployment confidence: {latestAnalysis.deploymentConfidence}%
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Codebase Overview</p>
            <p className="text-lg font-semibold text-slate-900">{latestAnalysis.codebaseOverview.framework}</p>
            <p className="text-sm text-slate-600">{latestAnalysis.codebaseOverview.language}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">CPU Usage</p>
            <p className="text-2xl font-semibold text-slate-900">{highestLoad?.cpuUsage ?? "n/a"}</p>
            <p className="text-sm text-slate-600">Estimated cores: {latestAnalysis.usage.estimatedCpuCores ?? "n/a"}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Memory Usage</p>
            <p className="text-2xl font-semibold text-slate-900">{highestLoad?.memoryUsage ?? "n/a"}</p>
            <p className="text-sm text-slate-600">Estimated memory: {latestAnalysis.usage.estimatedMemoryGb ?? "n/a"}GB</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Deployment Confidence</p>
            <p className="text-2xl font-semibold text-slate-900">{latestAnalysis.deploymentConfidence}%</p>
            <p className="text-sm text-slate-600">{cpuUsage > 90 ? "High-load caution" : "Within acceptable range"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Workflow className="h-5 w-5 text-primary" /> Pipeline Graph
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-5 text-sm text-slate-700">
            <p>Nodes: {latestAnalysis.pipelineGraph.nodes.map((n) => n.id).join(" -> ")}</p>
            <p>
              Edges: {latestAnalysis.pipelineGraph.edges.map((e) => `${e.source}=>${e.target}`).join(", ")}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Infrastructure Compatibility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-5 text-sm text-slate-700">
            {latestAnalysis.infrastructureCompatibility ? (
              <>
                <p>Result: {latestAnalysis.infrastructureCompatibility.result}</p>
                <p>
                  Memory: Server {latestAnalysis.infrastructureCompatibility.serverMemoryGb}GB / Required {latestAnalysis.infrastructureCompatibility.predictedMemoryGb}GB
                </p>
                <p>
                  CPU: Server {latestAnalysis.infrastructureCompatibility.serverCpuCores} / Required {latestAnalysis.infrastructureCompatibility.predictedCpuCores}
                </p>
              </>
            ) : (
              <p>Compatibility check pending.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Traffic Simulation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 md:grid-cols-3">
          {latestAnalysis.trafficSimulation.map((scenario) => (
            <div key={scenario.users} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-semibold text-slate-900">{scenario.users.toLocaleString()} users</p>
              <p className="text-slate-600">CPU: {scenario.cpuUsage}</p>
              <p className="text-slate-600">Memory: {scenario.memoryUsage}</p>
              <p className="text-slate-600">Latency: {scenario.latency}</p>
              <p className="text-slate-600">Failure: {scenario.failureProbability}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Preventive Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {latestAnalysis.suggestions.map((item, index) => (
            <div key={`${item.issue}-${index}`} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-semibold text-slate-900">{item.issue}</p>
              <p className="text-slate-700">{item.solution}</p>
              <p className="text-xs text-slate-500">Code location: {item.codeLocation ?? "n/a"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-700">
            <Cpu className="h-4 w-4 text-primary" />
            Estimated CPU requirement is {latestAnalysis.usage.estimatedCpuCores ?? "n/a"} cores.
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-700">
            <HardDrive className="h-4 w-4 text-primary" />
            Estimated memory requirement is {latestAnalysis.usage.estimatedMemoryGb ?? "n/a"}GB.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
