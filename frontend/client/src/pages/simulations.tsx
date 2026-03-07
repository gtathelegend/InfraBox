import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";

export default function SimulationsPage() {
  const { selectedRepo, latestAnalysis } = useWorkspace();

  if (!latestAnalysis || !selectedRepo) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        Run analysis to view traffic simulation output.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Traffic Simulation</h1>
        <p className="mt-1 text-sm text-slate-600">Scenario simulation for {selectedRepo.fullName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {latestAnalysis.trafficSimulation.map((scenario) => (
          <Card key={scenario.users} className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">{scenario.users.toLocaleString()} users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-slate-700">
              <p>CPU usage: {scenario.cpuUsage}</p>
              <p>Memory usage: {scenario.memoryUsage}</p>
              <p>Latency: {scenario.latency}</p>
              <p>Failure probability: {scenario.failureProbability}</p>
              {scenario.risk ? <p className="text-red-600">Risk: {scenario.risk}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
