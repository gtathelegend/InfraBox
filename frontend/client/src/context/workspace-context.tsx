import * as React from "react";

import type { DashboardDataResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type RepoContext = {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  branch: string;
  lastCommitAgo: string;
  url?: string;
};

type DashboardMetrics = {
  deploymentConfidenceScore: number;
  activeRepositories: number;
  simulationStatus: string;
  infrastructureHealth: number;
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
  errorRate: number;
};

type RunAnalysisOptions = {
  withModal?: boolean;
  repositoryId?: string;
  branch?: string;
};

type WorkspaceContextValue = {
  selectedRepo: RepoContext | null;
  setSelectedRepo: (repo: RepoContext | null) => void;
  metrics: DashboardMetrics;
  dashboardData: DashboardDataResponse | null;
  analysisSteps: string[];
  analysisStepIndex: number;
  analysisModalOpen: boolean;
  isAnalyzing: boolean;
  refreshDashboard: (repositoryId?: string) => Promise<void>;
  runFullAnalysis: (options?: RunAnalysisOptions) => Promise<void>;
};

const STORAGE_KEY = "infrabox.selectedRepo";

const initialMetrics: DashboardMetrics = {
  deploymentConfidenceScore: 0,
  activeRepositories: 0,
  simulationStatus: "Idle",
  infrastructureHealth: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  latency: 0,
  errorRate: 0,
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

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [selectedRepo, setSelectedRepoState] = React.useState<RepoContext | null>(null);
  const [metrics, setMetrics] = React.useState<DashboardMetrics>(initialMetrics);
  const [dashboardData, setDashboardData] = React.useState<DashboardDataResponse | null>(null);
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
      setDashboardData(null);
      setMetrics(initialMetrics);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(repo));
  }, []);

  const refreshDashboard = React.useCallback(
    async (repositoryId?: string) => {
      const repoId = repositoryId ?? selectedRepo?.id;
      if (!repoId) return;

      const [dashboardRes, reposRes] = await Promise.all([
        apiRequest("GET", `/api/dashboard/${encodeURIComponent(repoId)}`),
        apiRequest("GET", "/api/repositories"),
      ]);

      const dashboard = (await dashboardRes.json()) as DashboardDataResponse;
      const connectedRepos = (await reposRes.json()) as Array<{ id: string }>;

      const avgRisk =
        dashboard.predictions.length > 0
          ? dashboard.predictions.reduce((sum, prediction) => sum + prediction.probability, 0) /
            dashboard.predictions.length
          : 0;

      setDashboardData(dashboard);
      setMetrics({
        deploymentConfidenceScore: dashboard.metrics.deploymentScore,
        activeRepositories: connectedRepos.length,
        simulationStatus: "Completed",
        infrastructureHealth: Math.max(0, Math.round(100 - avgRisk * 0.75)),
        cpuUsage: dashboard.metrics.cpuUsage,
        memoryUsage: dashboard.metrics.memoryUsage,
        latency: dashboard.metrics.latency,
        errorRate: dashboard.metrics.errorRate,
      });
    },
    [selectedRepo?.id],
  );

  React.useEffect(() => {
    if (!selectedRepo?.id) return;

    refreshDashboard(selectedRepo.id).catch(() => {
      // keep previous metrics if dashboard fetch fails
    });
  }, [refreshDashboard, selectedRepo?.id]);

  const runFullAnalysis = React.useCallback(
    async (options?: RunAnalysisOptions) => {
      if (isAnalyzing) return;

      const repoId = options?.repositoryId ?? selectedRepo?.id;
      if (!repoId) return;

      const withModal = options?.withModal ?? true;
      setIsAnalyzing(true);
      setAnalysisStepIndex(0);
      if (withModal) setAnalysisModalOpen(true);

      for (let index = 0; index < analysisSteps.length; index += 1) {
        setAnalysisStepIndex(index);
        await wait(320);
      }

      await apiRequest("POST", "/api/analysis/run", {
        repositoryId: repoId,
        ...(options?.branch ? { branch: options.branch } : {}),
      });

      await refreshDashboard(repoId);
      await wait(300);

      setIsAnalyzing(false);
      if (withModal) setAnalysisModalOpen(false);
    },
    [isAnalyzing, refreshDashboard, selectedRepo?.id],
  );

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      selectedRepo,
      setSelectedRepo,
      metrics,
      dashboardData,
      analysisSteps,
      analysisStepIndex,
      analysisModalOpen,
      isAnalyzing,
      refreshDashboard,
      runFullAnalysis,
    }),
    [
      selectedRepo,
      setSelectedRepo,
      metrics,
      dashboardData,
      analysisStepIndex,
      analysisModalOpen,
      isAnalyzing,
      refreshDashboard,
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
