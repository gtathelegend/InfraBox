import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";
import { apiRequest } from "@/lib/queryClient";
import { deploymentTimeline } from "@/lib/infrabox-data";

export default function DeploymentsPage() {
  const { selectedRepo, dashboardData, refreshDashboard } = useWorkspace();
  const [isDeploying, setIsDeploying] = React.useState(false);
  const [deploymentMessage, setDeploymentMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedRepo?.id) return;
    if (dashboardData?.repository.id === selectedRepo.id) return;
    refreshDashboard(selectedRepo.id).catch(() => {
      // Keep stale data if fetch fails.
    });
  }, [dashboardData?.repository.id, refreshDashboard, selectedRepo?.id]);

  const deploymentScore = dashboardData?.metrics.deploymentScore ?? 0;
  const deploymentStatus = dashboardData?.metrics.deploymentStatus ?? "UNKNOWN";
  const failureScore = dashboardData?.metrics.failurePredictionScore ?? 0;
  const remediationScore = dashboardData?.metrics.remediationScore ?? 0;
  const costScore = dashboardData?.metrics.costPredictionScore ?? 0;

  const runDeployment = async (provider: "vercel" | "vultr") => {
    if (!selectedRepo?.id || isDeploying) return;
    setIsDeploying(true);
    setDeploymentMessage(null);
    try {
      const response = await apiRequest("POST", "/api/deploy", {
        repositoryId: selectedRepo.id,
        provider,
        environment: "production",
      });
      const payload = (await response.json()) as {
        status: string;
        provider: string;
      };
      setDeploymentMessage(
        `Deployment ${payload.status} on ${payload.provider.toUpperCase()}.`,
      );
      await refreshDashboard(selectedRepo.id);
    } catch (error) {
      setDeploymentMessage(
        error instanceof Error ? error.message : "Deployment request failed.",
      );
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Deployment Control</h1>
        <p className="mt-1 text-sm text-slate-600">
          Final release gate with confidence score and approval controls
          {selectedRepo ? ` for ${selectedRepo.fullName}` : ""}.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">Deployment Confidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-primary">
                Score
              </p>
              <p className="mt-1 text-4xl font-bold text-slate-900">
                {deploymentScore} / 100
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              {deploymentStatus}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-red-700">Failure Score</p>
                <p className="mt-1 text-xl font-semibold text-red-800">{failureScore}/100</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-amber-700">Cost Score</p>
                <p className="mt-1 text-xl font-semibold text-amber-800">{costScore}/100</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-emerald-700">Remediation</p>
                <p className="mt-1 text-xl font-semibold text-emerald-800">{remediationScore}/100</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RippleButton
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => runDeployment("vercel")}
                disabled={!selectedRepo || isDeploying}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isDeploying ? "Deploying..." : "Deploy on Vercel"}
              </RippleButton>
              <RippleButton
                variant="outline"
                className="border-red-200 text-red-700"
                onClick={() => runDeployment("vultr")}
                disabled={!selectedRepo || isDeploying}
              >
                <XCircle className="h-4 w-4" />
                {isDeploying ? "Deploying..." : "Deploy on Vultr"}
              </RippleButton>
            </div>
            {deploymentMessage ? (
              <p className="text-sm text-slate-600">{deploymentMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">Deployment Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {deploymentTimeline.map((event, index) => (
                <div key={event.title} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-0.5 h-3.5 w-3.5 rounded-full ${
                        event.status === "done"
                          ? "bg-emerald-500"
                          : event.status === "active"
                            ? "bg-primary animate-pulse"
                            : "bg-slate-300"
                      }`}
                    />
                    {index < deploymentTimeline.length - 1 ? (
                      <span className="h-10 w-px bg-slate-200" />
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                      {event.time}
                    </p>
                    <p className="text-sm font-medium text-slate-900">{event.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
