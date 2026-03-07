import * as React from "react";

type RepoContext = {
  owner: string;
  name: string;
  fullName: string;
  branch: string;
  lastCommitAgo: string;
};

type DashboardMetrics = {
  deploymentConfidenceScore: number;
  activeRepositories: number;
  simulationStatus: string;
  infrastructureHealth: number;
};

type RunAnalysisOptions = {
  withModal?: boolean;
};

type WorkspaceContextValue = {
  selectedRepo: RepoContext | null;
  setSelectedRepo: (repo: RepoContext | null) => void;
  metrics: DashboardMetrics;
  metricsLoading: boolean;
  analysisSteps: string[];
  analysisStepIndex: number;
  analysisModalOpen: boolean;
  isAnalyzing: boolean;
  runFullAnalysis: (options?: RunAnalysisOptions) => Promise<void>;
};

const STORAGE_KEY = "infrabox.selectedRepo";

const initialMetrics: DashboardMetrics = {
  deploymentConfidenceScore: 0,
  activeRepositories: 0,
  simulationStatus: "Unknown",
  infrastructureHealth: 0,
};

const analysisSteps = [
  "Scanning repository",
  "Detecting dependencies",
  "Parsing CI/CD pipeline",
  "Running simulation",
  "Predicting failures",
  "Calculating deployment score",
];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type PipelineItem = { status?: string; confidenceScore?: number | null };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [selectedRepo, setSelectedRepoState] = React.useState<RepoContext | null>(null);
  const [metrics, setMetrics] = React.useState<DashboardMetrics>(initialMetrics);
  const [metricsLoading, setMetricsLoading] = React.useState(true);
  const [analysisStepIndex, setAnalysisStepIndex] = React.useState(-1);
  const [analysisModalOpen, setAnalysisModalOpen] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  React.useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as RepoContext;
      setSelectedRepoState(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setSelectedRepo = React.useCallback((repo: RepoContext | null) => {
    setSelectedRepoState(repo);
    if (!repo) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(repo));
  }, []);

  const refreshMetrics = React.useCallback(async (repoName?: string) => {
    setMetricsLoading(true);
    try {
      const [reposRes, pipelinesRes, incidentsRes] = await Promise.all([
        fetch("/api/repositories", { credentials: "include" }),
        fetch("/api/pipelines", { credentials: "include" }),
        fetch("/api/incidents", { credentials: "include" }),
      ]);

      const repos = reposRes.ok ? ((await reposRes.json()) as unknown[]) : [];
      const pipelines = pipelinesRes.ok ? ((await pipelinesRes.json()) as PipelineItem[]) : [];
      const incidents = incidentsRes.ok
        ? ((await incidentsRes.json()) as Array<{ status?: string }>)
        : [];

      const repoQuery = repoName ?? selectedRepo?.name ?? "workspace";
      const simulationRes = await fetch(`/api/simulation?repo=${encodeURIComponent(repoQuery)}`, {
        credentials: "include",
      });

      const failedPipelines = pipelines.filter((p) => p.status === "failed").length;
      const openIncidents = incidents.filter((i) => i.status !== "resolved").length;
      const confidenceScores = pipelines
        .map((p) => p.confidenceScore ?? 0)
        .filter((score) => Number.isFinite(score));
      const averageConfidence = confidenceScores.length
        ? Math.round(confidenceScores.reduce((acc, score) => acc + score, 0) / confidenceScores.length)
        : 0;

      setMetrics({
        deploymentConfidenceScore: averageConfidence,
        activeRepositories: repos.length,
        simulationStatus: simulationRes.ok ? "Completed" : "Unavailable",
        infrastructureHealth: clamp(100 - failedPipelines * 8 - openIncidents * 12, 35, 100),
      });
    } catch {
      setMetrics(initialMetrics);
    } finally {
      setMetricsLoading(false);
    }
  }, [selectedRepo?.name]);

  React.useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  const runFullAnalysis = React.useCallback(
    async (options?: RunAnalysisOptions) => {
      if (isAnalyzing) return;

      const withModal = options?.withModal ?? true;
      setIsAnalyzing(true);
      setAnalysisStepIndex(0);
      if (withModal) setAnalysisModalOpen(true);

      try {
        const repo = selectedRepo?.fullName ?? "workspace/default";

        setAnalysisStepIndex(0);
        await fetch("/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ repo }),
        });

        setAnalysisStepIndex(1);
        await fetch(`/api/analysis?repo=${encodeURIComponent(repo)}`, {
          credentials: "include",
        });

        setAnalysisStepIndex(2);
        await fetch(`/api/pipeline?repo=${encodeURIComponent(repo)}`, {
          credentials: "include",
        });

        setAnalysisStepIndex(3);
        await fetch(`/api/simulation?repo=${encodeURIComponent(repo)}`, {
          credentials: "include",
        });

        setAnalysisStepIndex(4);
        await wait(250);
        setAnalysisStepIndex(5);

        await refreshMetrics(selectedRepo?.name);
      } finally {
        await wait(300);
        setIsAnalyzing(false);
        if (withModal) setAnalysisModalOpen(false);
      }
    },
    [isAnalyzing, refreshMetrics, selectedRepo?.fullName, selectedRepo?.name],
  );

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      selectedRepo,
      setSelectedRepo,
      metrics,
      metricsLoading,
      analysisSteps,
      analysisStepIndex,
      analysisModalOpen,
      isAnalyzing,
      runFullAnalysis,
    }),
    [
      selectedRepo,
      setSelectedRepo,
      metrics,
      metricsLoading,
      analysisStepIndex,
      analysisModalOpen,
      isAnalyzing,
      runFullAnalysis,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider.");
  }
  return context;
}
