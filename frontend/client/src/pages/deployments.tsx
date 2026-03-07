import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";
import { usePipelines } from "@/hooks/use-pipelines";

export default function DeploymentsPage() {
  const { data: pipelines, isLoading } = usePipelines();

  const confidence = React.useMemo(() => {
    if (!pipelines?.length) return 0;
    const scores = pipelines.map((pipeline) => pipeline.confidenceScore ?? 0);
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [pipelines]);

  const deploymentTimeline = React.useMemo(() => {
    if (!pipelines?.length) return [];
    return pipelines.slice(0, 5).map((pipeline, index) => ({
      time: pipeline.createdAt ? new Date(pipeline.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "n/a",
      title: `${pipeline.name} (${pipeline.status})`,
      status: index === 0 ? "active" : pipeline.status === "success" ? "done" : "pending",
    }));
  }, [pipelines]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Deployment Control</h1>
        <p className="mt-1 text-sm text-slate-600">
          Final release gate with confidence score and approval controls.
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
                {isLoading ? "..." : `${confidence} / 100`}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              {confidence >= 70 ? "SAFE TO DEPLOY" : "REVIEW REQUIRED"}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RippleButton className="bg-emerald-600 text-white hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Approve Deployment
              </RippleButton>
              <RippleButton variant="outline" className="border-red-200 text-red-700">
                <XCircle className="h-4 w-4" />
                Block Deployment
              </RippleButton>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="text-lg">Deployment Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {isLoading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                  Loading deployment timeline...
                </div>
              ) : null}

              {!isLoading && deploymentTimeline.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                  No deployment history available.
                </div>
              ) : null}

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
