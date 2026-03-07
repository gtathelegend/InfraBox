import { motion } from "framer-motion";
import { CheckCircle2, Github, Search } from "lucide-react";
import * as React from "react";
import { useLocation } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RippleButton } from "@/components/ui/ripple-button";
import { Switch } from "@/components/ui/switch";
import { useRepositories } from "@/hooks/use-repositories";
import { formatRepo, useWorkspace } from "@/context/workspace-context";

type InfrastructureForm = {
  provider: string;
  cpu: string;
  memoryGb: string;
  storageGb: string;
  autoscaling: boolean;
  region: string;
};

const defaultInfrastructure: InfrastructureForm = {
  provider: "aws",
  cpu: "4",
  memoryGb: "8",
  storageGb: "120",
  autoscaling: true,
  region: "us-east-1",
};

export default function ConnectRepositoryPage() {
  const [, navigate] = useLocation();
  const {
    workspace,
    selectedRepo,
    setSelectedRepo,
    runFullAnalysis,
    isAnalyzing,
    analysisStepIndex,
    analysisSteps,
    refreshMetrics,
  } = useWorkspace();

  const { data: repositories, isLoading: reposLoading, refetch } = useRepositories(workspace?.id);

  const [query, setQuery] = React.useState("");
  const [selectedRepoId, setSelectedRepoId] = React.useState<number | null>(selectedRepo?.id ?? null);
  const [form, setForm] = React.useState<InfrastructureForm>(defaultInfrastructure);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const repoOptions = React.useMemo(() => {
    return (repositories ?? []).map((repo) => ({
      id: repo.id,
      fullName: repo.name,
      branch: repo.defaultBranch ?? "main",
      lastAnalyzed: repo.lastAnalyzed,
    }));
  }, [repositories]);

  const filteredRepos = React.useMemo(() => {
    if (!query.trim()) return repoOptions;
    const q = query.toLowerCase();
    return repoOptions.filter((repo) => repo.fullName.toLowerCase().includes(q));
  }, [query, repoOptions]);

  const selectedRepoMeta = React.useMemo(
    () => repoOptions.find((repo) => repo.id === selectedRepoId) ?? null,
    [repoOptions, selectedRepoId],
  );

  const handleFormChange = (key: keyof InfrastructureForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartAnalysis = async () => {
    if (!workspace?.id || !selectedRepoMeta) return;

    setSubmitError(null);
    try {
      const repoContext = formatRepo(
        selectedRepoMeta.fullName,
        selectedRepoMeta.id,
        selectedRepoMeta.branch,
        selectedRepoMeta.lastAnalyzed,
      );
      setSelectedRepo(repoContext);

      const configResponse = await fetch("/api/infrastructure/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          repoId: selectedRepoMeta.id,
          provider: form.provider,
          cpu: Number(form.cpu),
          memoryGb: Number(form.memoryGb),
          storageGb: Number(form.storageGb),
          autoscaling: form.autoscaling,
          region: form.region,
        }),
      });

      if (!configResponse.ok) {
        throw new Error("Failed to store infrastructure configuration");
      }

      await runFullAnalysis({ withModal: false });
      await refreshMetrics();
      navigate("/dashboard");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to run onboarding flow");
    }
  };

  if (!workspace) {
    return (
      <div className="mx-auto mt-20 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        Complete login first to initialize your workspace.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-5 py-8 md:px-8">
      <div className="pointer-events-none absolute inset-0 floating-bg opacity-35" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-700">
          <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Workspace ready: {workspace.name}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card rounded-3xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-bold text-slate-900">Git Integration</CardTitle>
              <p className="text-sm text-slate-600">Connect GitHub and select a repository.</p>
              <RippleButton
                variant="outline"
                className="h-10 w-fit border-slate-300 bg-white"
                onClick={() => {
                  void refetch();
                }}
              >
                Connect GitHub
              </RippleButton>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search repositories"
                  className="h-11 rounded-xl border-slate-300 bg-white pl-9"
                />
              </div>

              <div className="max-h-[380px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {reposLoading ? (
                  <div className="px-4 py-8 text-sm text-slate-500">Loading repositories...</div>
                ) : null}

                {!reposLoading && filteredRepos.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-slate-500">
                    No repositories found. Make sure GitHub token is configured.
                  </div>
                ) : null}

                {filteredRepos.map((repo, index) => {
                  const active = selectedRepoId === repo.id;
                  return (
                    <motion.button
                      key={repo.id}
                      type="button"
                      data-testid={`repo-option-${index}`}
                      onClick={() => setSelectedRepoId(repo.id)}
                      className={`flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                        active ? "bg-primary/10" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Github className="h-4 w-4 text-slate-700" />
                        <span className="font-medium text-slate-800">{repo.fullName}</span>
                      </span>
                      <span className="text-xs text-slate-500">{repo.branch}</span>
                    </motion.button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card rounded-3xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-bold text-slate-900">Cloud Server Configuration</CardTitle>
              <p className="text-sm text-slate-600">
                Required before codebase analysis and traffic simulation.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="provider">Cloud Provider</Label>
                  <Input
                    id="provider"
                    value={form.provider}
                    onChange={(event) => handleFormChange("provider", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    value={form.region}
                    onChange={(event) => handleFormChange("region", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpu">CPU cores</Label>
                  <Input
                    id="cpu"
                    type="number"
                    value={form.cpu}
                    onChange={(event) => handleFormChange("cpu", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memory">RAM (GB)</Label>
                  <Input
                    id="memory"
                    type="number"
                    value={form.memoryGb}
                    onChange={(event) => handleFormChange("memoryGb", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage">Storage (GB)</Label>
                  <Input
                    id="storage"
                    type="number"
                    value={form.storageGb}
                    onChange={(event) => handleFormChange("storageGb", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="autoscaling">Autoscaling Enabled</Label>
                  <div className="flex h-10 items-center rounded-xl border border-slate-300 px-3">
                    <Switch
                      id="autoscaling"
                      checked={form.autoscaling}
                      onCheckedChange={(value) => handleFormChange("autoscaling", value)}
                    />
                  </div>
                </div>
              </div>

              {isAnalyzing ? (
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                  <p className="text-xs uppercase tracking-[0.1em] text-primary">Analysis Progress</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {analysisStepIndex >= 0 ? analysisSteps[analysisStepIndex] : "Preparing"}
                  </p>
                </div>
              ) : null}

              {submitError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {submitError}
                </div>
              ) : null}

              <RippleButton
                className="h-11 w-full bg-primary text-white hover:bg-primary/90"
                onClick={handleStartAnalysis}
                disabled={!selectedRepoMeta || reposLoading || isAnalyzing}
                data-testid="analyze-repo-btn"
              >
                {isAnalyzing ? "Running analysis..." : "Run Analysis"}
              </RippleButton>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
