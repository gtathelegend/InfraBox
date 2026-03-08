import { AlertTriangle, ArrowLeft, Wrench } from "lucide-react";
import * as React from "react";
import { useLocation, useRoute } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";

export default function PredictionDetailPage() {
  const [, params] = useRoute("/predictions/:service");
  const [, navigate] = useLocation();
  const { selectedRepo, dashboardData, refreshDashboard } = useWorkspace();

  const service = params?.service ?? "service";
  const serviceName = service.replace(/-/g, " ");

  React.useEffect(() => {
    if (!selectedRepo?.id) return;
    if (dashboardData?.repository.id === selectedRepo.id) return;
    refreshDashboard(selectedRepo.id).catch(() => {
      // Keep stale view on failure.
    });
  }, [dashboardData?.repository.id, refreshDashboard, selectedRepo?.id]);

  const matchingRisk =
    dashboardData?.predictions.find((risk) => {
      const slug = risk.service.toLowerCase().replace(/\s+/g, "-");
      return slug === service.toLowerCase();
    }) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <RippleButton
        variant="outline"
        className="border-slate-300 bg-white"
        onClick={() => navigate("/predictions")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Predictions
      </RippleButton>

      <Card className="glass-card rounded-2xl">
        <CardHeader className="border-b border-slate-200/80">
          <CardTitle className="text-2xl capitalize">
            {serviceName} Investigation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-red-700">
              {matchingRisk ? `${matchingRisk.riskType} detected` : "Risk signal unavailable"}
            </p>
            <p className="mt-1 text-sm font-semibold text-red-800">
              {matchingRisk
                ? `Probability ${matchingRisk.probability}% in ${matchingRisk.service}.`
                : "Run analysis to load prediction for this service."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="mb-2 flex items-center gap-2 font-medium text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Root cause summary
            </p>
            {matchingRisk
              ? `${matchingRisk.riskType} is currently marked ${matchingRisk.severity} severity.`
              : "No risk summary available for this service."}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="mb-2 flex items-center gap-2 font-medium text-slate-900">
              <Wrench className="h-4 w-4 text-primary" />
              Suggested remediation
            </p>
            {matchingRisk
              ? matchingRisk.suggestion
              : "No remediation available. Re-run full analysis to generate fix guidance."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
