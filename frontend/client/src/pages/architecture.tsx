import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";

export default function ArchitecturePage() {
  const { selectedRepo, latestAnalysis } = useWorkspace();

  if (!latestAnalysis || !selectedRepo) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        Run analysis to generate architecture details.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Codebase Analysis</h1>
        <p className="mt-1 text-sm text-slate-600">Architecture extracted for {selectedRepo.fullName}</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-lg">Service Dependency Graph</CardTitle></CardHeader>
        <CardContent className="space-y-2 p-5 text-sm text-slate-700">
          <p>Nodes: {latestAnalysis.codebaseOverview.services.join(" -> ")}</p>
          <p>
            Pipeline stages: {latestAnalysis.pipelineGraph.nodes.map((node) => node.id).join(" -> ")}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-lg">Dependencies</CardTitle></CardHeader>
        <CardContent className="p-5 text-sm text-slate-700">
          {latestAnalysis.codebaseOverview.dependencies.join(", ")}
        </CardContent>
      </Card>
    </div>
  );
}
