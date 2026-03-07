import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";

export default function RepositoriesPage() {
  const { selectedRepo, latestAnalysis } = useWorkspace();

  if (!latestAnalysis || !selectedRepo) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        Select repository and run analysis to view repository insights.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Repository Selection</h1>
        <p className="mt-1 text-sm text-slate-600">{selectedRepo.fullName} on branch {selectedRepo.branch}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl"><CardContent className="p-5 text-sm"><p className="text-slate-500">Framework</p><p className="font-semibold">{latestAnalysis.codebaseOverview.framework}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5 text-sm"><p className="text-slate-500">Backend</p><p className="font-semibold">{latestAnalysis.codebaseOverview.backend}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5 text-sm"><p className="text-slate-500">Database</p><p className="font-semibold">{latestAnalysis.codebaseOverview.database}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5 text-sm"><p className="text-slate-500">Cache</p><p className="font-semibold">{latestAnalysis.codebaseOverview.cache}</p></CardContent></Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-lg">Services</CardTitle></CardHeader>
        <CardContent className="p-5 text-sm text-slate-700">
          {latestAnalysis.codebaseOverview.services.join(", ")}
        </CardContent>
      </Card>
    </div>
  );
}
