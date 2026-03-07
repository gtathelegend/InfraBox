import { motion } from "framer-motion";
import { Github, Search, CheckCircle2 } from "lucide-react";
import * as React from "react";
import { useLocation } from "wouter";

import { RippleButton } from "@/components/ui/ripple-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useWorkspace } from "@/context/workspace-context";
import { useRepositories } from "@/hooks/use-repositories";

type RepoItem = {
  fullName: string;
  lastCommitAgo: string;
};

const parseRepo = (fullName: string) => {
  const [owner, name] = fullName.split("/");
  return { owner, name, fullName };
};

export default function ConnectRepositoryPage() {
  const [, navigate] = useLocation();
  const {
    setSelectedRepo,
    runFullAnalysis,
    analysisStepIndex,
    analysisSteps,
    isAnalyzing,
  } = useWorkspace();
  const { data: repositories, isLoading: reposLoading } = useRepositories();
  const [query, setQuery] = React.useState("");
  const [selectedRepo, setSelectedRepoName] = React.useState<string | null>(null);

  const repoOptions = React.useMemo<RepoItem[]>(() => {
    if (!repositories?.length) return [];
    return repositories.map((repo) => ({
      fullName: repo.name.includes("/") ? repo.name : `workspace/${repo.name}`,
      lastCommitAgo: repo.lastAnalyzed ? new Date(repo.lastAnalyzed).toLocaleString() : "Not analyzed",
    }));
  }, [repositories]);

  const filteredRepos = React.useMemo(() => {
    if (!query.trim()) return repoOptions;
    return repoOptions.filter((repo) =>
      repo.fullName.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query, repoOptions]);

  const handleAnalyzeRepository = async () => {
    if (!selectedRepo) return;

    const parsed = parseRepo(selectedRepo);

    await apiRequest("POST", "/analyze", { repo: selectedRepo });

    setSelectedRepo({
      ...parsed,
      branch: "main",
      lastCommitAgo: "5 minutes ago",
    });

    await runFullAnalysis({ withModal: false });
    navigate(`/dashboard?repo=${encodeURIComponent(parsed.name)}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-5 py-8 md:px-8">
      <div className="pointer-events-none absolute inset-0 floating-bg opacity-35" />
      <div className="relative z-10 mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-700">
          {!reposLoading ? (
            <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Workspace initialization complete
            </span>
          ) : (
            <span className="text-slate-500">Loading repositories...</span>
          )}
        </div>

        <Card className="glass-card rounded-3xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl font-bold text-slate-900">
              Connect Repository
            </CardTitle>
            <p className="text-sm text-slate-600">
              Select a repository to analyze
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search repositories..."
                className="h-11 rounded-xl border-slate-300 bg-white pl-9"
              />
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
              {!reposLoading && filteredRepos.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No repositories found.
                </div>
              ) : null}
              {filteredRepos.map((repo, index) => {
                const isSelected = selectedRepo === repo.fullName;
                return (
                  <motion.button
                    key={repo.fullName}
                    type="button"
                    onClick={() => setSelectedRepoName(repo.fullName)}
                    whileHover={{ x: 2 }}
                    data-testid={`repo-option-${index}`}
                    className={`flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                      isSelected ? "bg-primary/10" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Github className="h-4 w-4 text-slate-700" />
                      <span className="font-medium text-slate-800">
                        {repo.fullName.replace("/", " / ")}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500">{repo.lastCommitAgo}</span>
                  </motion.button>
                );
              })}
            </div>

            {isAnalyzing ? (
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                <p className="text-xs uppercase tracking-[0.1em] text-primary">
                  Analysis Progress
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {analysisStepIndex >= 0 ? analysisSteps[analysisStepIndex] : "Preparing"}
                </p>
              </div>
            ) : null}

            <RippleButton
              className="h-11 w-full bg-primary text-white hover:bg-primary/90"
              onClick={handleAnalyzeRepository}
              disabled={!selectedRepo || isAnalyzing || reposLoading}
              data-testid="analyze-repo-btn"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Repository"}
            </RippleButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
