import { motion } from "framer-motion";
import { AlertTriangle, Lightbulb, ShieldAlert } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWorkspace } from "@/context/workspace-context";

const riskColor: Record<string, string> = {
  danger: "text-red-700 bg-red-100 border-red-200",
  warning: "text-amber-700 bg-amber-100 border-amber-200",
  success: "text-emerald-700 bg-emerald-100 border-emerald-200",
};

export default function PredictionsPage() {
  const { selectedRepo, dashboardData, refreshDashboard } = useWorkspace();

  React.useEffect(() => {
    if (!selectedRepo?.id) return;
    if (dashboardData?.repository.id === selectedRepo.id) return;
    refreshDashboard(selectedRepo.id).catch(() => {
      // Keep existing rendered state if refresh fails.
    });
  }, [dashboardData?.repository.id, refreshDashboard, selectedRepo?.id]);

  const riskCards = React.useMemo(
    () =>
      dashboardData?.predictions.map((risk) => ({
        title: `${risk.riskType} Risk`,
        probability: risk.probability,
        service: risk.service,
        fix: risk.suggestion,
        tone:
          risk.severity === "high"
            ? "danger"
            : risk.severity === "medium"
              ? "warning"
              : "success",
      })) ?? [],
    [dashboardData],
  );

  const avgRisk =
    riskCards.length > 0
      ? Math.round(riskCards.reduce((sum, item) => sum + item.probability, 0) / riskCards.length)
      : null;
  const failureScore = dashboardData?.metrics.failurePredictionScore ?? 0;
  const remediationScore = dashboardData?.metrics.remediationScore ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Failure Prediction</h1>
        <p className="mt-1 text-sm text-slate-600">
          AI analysis highlights probable failure modes and mitigation actions
          {selectedRepo ? ` for ${selectedRepo.fullName}` : ""}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card rounded-2xl">
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
              Failure Prediction Score
            </p>
            <p className="text-3xl font-semibold text-red-600">{failureScore}/100</p>
            <p className="text-xs text-slate-500">Higher means higher expected failure risk.</p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-2xl">
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
              Remediation Readiness
            </p>
            <p className="text-3xl font-semibold text-emerald-600">{remediationScore}/100</p>
            <p className="text-xs text-slate-500">Score from spike-to-recovery simulation behavior.</p>
          </CardContent>
        </Card>
      </div>

      {riskCards.length === 0 ? (
        <Card className="glass-card rounded-2xl">
          <CardContent className="p-5 text-sm text-slate-600">
            No prediction data available yet. Run repository analysis to generate risk cards.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {riskCards.map((risk, index) => (
            <motion.div
              key={risk.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <Card className="glass-card h-full rounded-2xl">
                <CardHeader className="space-y-3 border-b border-slate-200/80">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{risk.title}</CardTitle>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        riskColor[risk.tone]
                      }`}
                    >
                      {risk.probability}% risk
                    </span>
                  </div>
                  <Progress value={risk.probability} />
                </CardHeader>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Affected service:{" "}
                    <span className="font-semibold text-slate-900">{risk.service}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <div className="mb-1 flex items-center gap-2 font-medium text-slate-900">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Suggested fix
                    </div>
                    {risk.fix}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Card className="glass-card rounded-2xl">
        <CardContent className="flex items-center gap-2 p-5 text-sm text-slate-700">
          <ShieldAlert className="h-4 w-4 text-primary" />
          {avgRisk !== null
            ? `Average risk is ${avgRisk}%. Model combines pipeline behavior and simulation telemetry for this repository.`
            : "Risk model combines historical failures, pipeline behavior, and simulation telemetry for this score."}
        </CardContent>
      </Card>
    </div>
  );
}
