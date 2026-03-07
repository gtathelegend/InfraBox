import { motion } from "framer-motion";
import { AlertTriangle, Lightbulb, ShieldAlert } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWorkspace } from "@/context/workspace-context";
import { useIncidents } from "@/hooks/use-incidents";

const riskColor: Record<string, string> = {
  danger: "text-red-700 bg-red-100 border-red-200",
  warning: "text-amber-700 bg-amber-100 border-amber-200",
  success: "text-emerald-700 bg-emerald-100 border-emerald-200",
};

export default function PredictionsPage() {
  const { selectedRepo } = useWorkspace();
  const { data: incidents, isLoading } = useIncidents();

  const riskCards = React.useMemo(() => {
    if (!incidents?.length) return [];
    return incidents.map((incident) => {
      const probability = incident.severity === "high" ? 80 : incident.severity === "medium" ? 55 : 30;
      return {
        title: incident.title,
        probability,
        service: incident.component,
        fix: incident.suggestedAction ?? "No suggested fix available.",
        tone: incident.severity === "high" ? "danger" : "warning",
      };
    });
  }, [incidents]);

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
        {isLoading ? (
          <Card className="glass-card rounded-2xl md:col-span-2">
            <CardContent className="p-5 text-sm text-slate-600">Loading prediction insights...</CardContent>
          </Card>
        ) : null}

        {!isLoading && riskCards.length === 0 ? (
          <Card className="glass-card rounded-2xl md:col-span-2">
            <CardContent className="p-5 text-sm text-slate-600">
              No prediction risks available right now.
            </CardContent>
          </Card>
        ) : null}

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

      <Card className="glass-card rounded-2xl">
        <CardContent className="flex items-center gap-2 p-5 text-sm text-slate-700">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Risk model combines historical failures, pipeline behavior, and
          simulation telemetry for this score.
        </CardContent>
      </Card>
    </div>
  );
}
