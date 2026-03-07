import { ArrowLeft, Clock3, Gauge, ShieldAlert } from "lucide-react";
import { useLocation, useRoute } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";

export default function PipelineStageDetailPage() {
  const [, params] = useRoute("/pipeline/:stage");
  const [, navigate] = useLocation();
  const stage = params?.stage ?? "stage";
  const stageName = stage.replace(/-/g, " ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <RippleButton
        variant="outline"
        className="border-slate-300 bg-white"
        onClick={() => navigate("/pipeline")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipeline
      </RippleButton>

      <Card className="glass-card rounded-2xl">
        <CardHeader className="border-b border-slate-200/80">
          <CardTitle className="text-2xl capitalize">
            {stageName} Stage Investigation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-amber-700">
              Build cache miss spike
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-800">
              Cache hit ratio dropped to 52% in the last execution.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-900">
                <Clock3 className="h-4 w-4 text-primary" />
                Duration
              </p>
              4m 46s
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-900">
                <Gauge className="h-4 w-4 text-primary" />
                Failure rate
              </p>
              6.2%
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-900">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Risk score
              </p>
              Medium
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
