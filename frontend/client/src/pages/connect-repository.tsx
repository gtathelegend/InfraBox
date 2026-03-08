import { motion } from "framer-motion";
import { CheckCircle2, Github, RefreshCw, Search } from "lucide-react";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { RippleButton } from "@/components/ui/ripple-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";
import { useToast } from "@/hooks/use-toast";
import {
  getGitHubTokenFromStorage,
  saveGitHubTokenToStorage,
} from "@/lib/auth-token";
import { apiRequest } from "@/lib/queryClient";

type GitHubRepo = {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string;
};

type ConnectedRepo = {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  url: string;
};

const formatRelativeTime = (iso?: string) => {
  if (!iso) return "just now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function ConnectRepositoryPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const {
    setSelectedRepo,
    analysisStepIndex,
    analysisSteps,
    isAnalyzing,
  } = useWorkspace();

  const [query, setQuery] = React.useState("");
  const [selectedRepoId, setSelectedRepoId] = React.useState<number | null>(null);
  const [workspaceReady, setWorkspaceReady] = React.useState(false);
  const [githubTokenInput, setGithubTokenInput] = React.useState(
    () => getGitHubTokenFromStorage() ?? "",
  );

  const {
    data: repos = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["github-repos"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/github/repos");
      return (await response.json()) as GitHubRepo[];
    },
    staleTime: 1000 * 60,
  });

  const repositoryLoadError =
    error instanceof Error
      ? error.message
      : "Failed to load repositories. Ensure Auth0 GitHub access token claim is configured.";
  const isMissingGitHubToken = repositoryLoadError
    .toLowerCase()
    .includes("github token missing");

  React.useEffect(() => {
    const timer = window.setTimeout(() => setWorkspaceReady(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredRepos = React.useMemo(() => {
    if (!query.trim()) return repos;
    return repos.filter((repo) =>
      repo.fullName.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query, repos]);

  const selectedRepo = React.useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );

  const handleAnalyzeRepository = async () => {
    if (!selectedRepo) return;

    try {
      const connectResponse = await apiRequest("POST", "/api/repositories/connect", {
        owner: selectedRepo.owner,
        name: selectedRepo.name,
        fullName: selectedRepo.fullName,
        defaultBranch: selectedRepo.defaultBranch,
        url: selectedRepo.htmlUrl,
        githubRepoId: String(selectedRepo.id),
        lastCommitAt: selectedRepo.updatedAt,
      });

      const connected = (await connectResponse.json()) as ConnectedRepo;

      setSelectedRepo({
        id: connected.id,
        owner: connected.owner,
        name: connected.name,
        fullName: connected.fullName,
        branch: connected.defaultBranch,
        url: connected.url,
        lastCommitAgo: formatRelativeTime(selectedRepo.updatedAt),
      });

      navigate(`/configure-infrastructure?repositoryId=${connected.id}`);
    } catch (error) {
      toast({
        title: "Repository connection failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to connect repository right now.",
        variant: "destructive",
      });
    }
  };

  const handleSaveGithubToken = async () => {
    saveGitHubTokenToStorage(githubTokenInput);
    await refetch();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-5 py-8 md:px-8">
      <div className="pointer-events-none absolute inset-0 floating-bg opacity-35" />
      <div className="relative z-10 mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-700">
          {workspaceReady ? (
            <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Workspace initialization complete
            </span>
          ) : (
            <span className="text-slate-500">Initializing workspace...</span>
          )}
        </div>

        <Card className="glass-card rounded-3xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl font-bold text-slate-900">Connect Repository</CardTitle>
            <p className="text-sm text-slate-600">Select a GitHub repository to analyze</p>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search repositories..."
                  className="h-11 rounded-xl border-slate-300 bg-white pl-9"
                />
              </div>

              <RippleButton
                variant="outline"
                className="h-11 border-slate-300 bg-white"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </RippleButton>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
              {isLoading ? (
                <div className="p-5 text-sm text-slate-500">Loading repositories...</div>
              ) : error ? (
                <div className="space-y-4 p-5">
                  <div className="text-sm text-red-600">{repositoryLoadError}</div>

                  {isMissingGitHubToken ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                        GitHub Token Fallback
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Paste a GitHub personal access token with `repo` and `read:org` scopes.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Input
                          type="password"
                          value={githubTokenInput}
                          onChange={(event) => setGithubTokenInput(event.target.value)}
                          placeholder="ghp_..."
                          className="h-10 bg-white"
                        />
                        <RippleButton
                          type="button"
                          onClick={handleSaveGithubToken}
                          className="h-10 bg-primary text-white hover:bg-primary/90"
                        >
                          Save & Retry
                        </RippleButton>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">No repositories found.</div>
              ) : (
                filteredRepos.map((repo) => {
                  const isSelected = selectedRepoId === repo.id;
                  return (
                    <motion.button
                      key={repo.id}
                      type="button"
                      onClick={() => setSelectedRepoId(repo.id)}
                      whileHover={{ x: 2 }}
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
                      <span className="text-xs text-slate-500">{formatRelativeTime(repo.updatedAt)}</span>
                    </motion.button>
                  );
                })
              )}
            </div>

            {isAnalyzing ? (
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                <p className="text-xs uppercase tracking-[0.1em] text-primary">Analysis Progress</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {analysisStepIndex >= 0 ? analysisSteps[analysisStepIndex] : "Preparing"}
                </p>
              </div>
            ) : null}

            <RippleButton
              className="h-11 w-full bg-primary text-white hover:bg-primary/90"
              onClick={handleAnalyzeRepository}
              disabled={!selectedRepo || isAnalyzing || !workspaceReady}
            >
              {isAnalyzing ? "Connecting..." : "Connect & Configure Infrastructure"}
            </RippleButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
