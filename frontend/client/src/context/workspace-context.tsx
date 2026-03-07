import * as React from "react";

type RepoContext = {
  id: number;
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

type UserState = {
  id: number;
  auth0Id: string;
  email: string;
  workspaceId: number | null;
};

type WorkspaceState = {
  id: number;
  name: string;
};

type AnalysisState = {
  analysisId: number;
  deploymentConfidence: number;
  pipelineGraph: { nodes: Array<{ id: string }>; edges: Array<{ source: string; target: string }> };
  trafficSimulation: Array<{
    users: number;
    cpuUsage: string;
    memoryUsage: string;
    latency: string;
    failureProbability: string;
    risk?: string;
  }>;
  infrastructureCompatibility: {
    result: string;
    serverMemoryGb: number;
    predictedMemoryGb: number;
    serverCpuCores: number;
    predictedCpuCores: number;
    risks: string[];
  } | null;
  suggestions: Array<{ issue: string; solution: string; codeLocation: string | null }>;
  codebaseOverview: {
    framework: string;
    backend: string;
    language: string;
    services: string[];
    dependencies: string[];
    database: string;
    cache: string;
  };
  usage: {
    estimatedCpuCores: number | null;
    estimatedMemoryGb: number | null;
  };
};

type WorkspaceContextValue = {
  user: UserState | null;
  workspace: WorkspaceState | null;
  role: string | null;
  selectedRepo: RepoContext | null;
  setSelectedRepo: (repo: RepoContext | null) => void;
  metrics: DashboardMetrics;
  metricsLoading: boolean;
  analysisSteps: string[];
  analysisStepIndex: number;
  analysisModalOpen: boolean;
  isAnalyzing: boolean;
  latestAnalysis: AnalysisState | null;
  bootstrapped: boolean;
  bootstrapSession: (auth0Id: string, email: string) => Promise<void>;
  refreshMetrics: () => Promise<void>;
  runFullAnalysis: (options?: RunAnalysisOptions) => Promise<void>;
};

const REPO_STORAGE_KEY = "infrabox.selectedRepo";
const AUTH_STORAGE_KEY = "infrabox.auth";

const initialMetrics: DashboardMetrics = {
  deploymentConfidenceScore: 0,
  activeRepositories: 0,
  simulationStatus: "Not started",
  infrastructureHealth: 0,
};

const analysisSteps = [
  "Queueing AI analysis job",
  "Analyzing repository architecture",
  "Simulating traffic scenarios",
  "Evaluating infrastructure compatibility",
  "Generating preventive suggestions",
  "Finalizing dashboard results",
];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

function formatRepo(fullName: string, id: number, defaultBranch?: string | null, lastAnalyzed?: string | null): RepoContext {
  const [owner, name] = fullName.includes("/") ? fullName.split("/") : ["workspace", fullName];
  const lastCommitAgo = lastAnalyzed ? new Date(lastAnalyzed).toLocaleString() : "Not analyzed";
  return {
    id,
    owner,
    name,
    fullName,
    branch: defaultBranch ?? "main",
    lastCommitAgo,
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [bootstrapped, setBootstrapped] = React.useState(false);
  const [user, setUser] = React.useState<UserState | null>(null);
  const [workspace, setWorkspace] = React.useState<WorkspaceState | null>(null);
  const [role, setRole] = React.useState<string | null>(null);

  const [selectedRepo, setSelectedRepoState] = React.useState<RepoContext | null>(null);
  const [metrics, setMetrics] = React.useState<DashboardMetrics>(initialMetrics);
  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = React.useState(-1);
  const [analysisModalOpen, setAnalysisModalOpen] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [latestAnalysis, setLatestAnalysis] = React.useState<AnalysisState | null>(null);

  const setSelectedRepo = React.useCallback((repo: RepoContext | null) => {
    setSelectedRepoState(repo);
    if (!repo) {
      window.localStorage.removeItem(REPO_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(repo));
  }, []);

  const loadAnalysis = React.useCallback(async (workspaceId: number, repoId: number) => {
    const response = await fetch(
      `/api/dashboard/result?workspaceId=${workspaceId}&repoId=${repoId}`,
      { credentials: "include" },
    );

    if (!response.ok) {
      setLatestAnalysis(null);
      return;
    }

    const payload = (await response.json()) as (AnalysisState & { analysisId?: number | null });
    if (!payload.analysisId) {
      setLatestAnalysis(null);
      setMetrics((prev) => ({
        ...prev,
        deploymentConfidenceScore: 0,
        simulationStatus: "Not started",
        infrastructureHealth: 0,
      }));
      return;
    }

    setLatestAnalysis(payload);

    const risks = payload.infrastructureCompatibility?.risks.length ?? 0;
    setMetrics({
      deploymentConfidenceScore: payload.deploymentConfidence,
      activeRepositories: metrics.activeRepositories,
      simulationStatus: payload.trafficSimulation.length ? "Completed" : "Not started",
      infrastructureHealth: Math.max(20, 100 - risks * 18),
    });
  }, [metrics.activeRepositories]);

  const refreshMetrics = React.useCallback(async () => {
    if (!workspace?.id) {
      setMetrics(initialMetrics);
      return;
    }

    setMetricsLoading(true);
    try {
      const reposRes = await fetch(`/api/git/repos?workspaceId=${workspace.id}`, {
        credentials: "include",
      });
      const repos = reposRes.ok ? ((await reposRes.json()) as Array<{ id: number }>) : [];

      setMetrics((prev) => ({
        ...prev,
        activeRepositories: repos.length,
      }));

      if (selectedRepo) {
        await loadAnalysis(workspace.id, selectedRepo.id);
      }
    } finally {
      setMetricsLoading(false);
    }
  }, [workspace?.id, selectedRepo, loadAnalysis]);

  const bootstrapSession = React.useCallback(async (auth0Id: string, email: string) => {
    const response = await fetch(
      `/api/me?auth0Id=${encodeURIComponent(auth0Id)}&email=${encodeURIComponent(email)}`,
      { credentials: "include" },
    );

    if (!response.ok) {
      throw new Error("Unable to initialize account");
    }

    const payload = (await response.json()) as {
      user: UserState;
      workspace: WorkspaceState;
      role: string;
    };

    setUser(payload.user);
    setWorkspace(payload.workspace);
    setRole(payload.role);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ auth0Id, email }));

    const repoRaw = window.localStorage.getItem(REPO_STORAGE_KEY);
    if (repoRaw) {
      try {
        const parsed = JSON.parse(repoRaw) as RepoContext;
        setSelectedRepoState(parsed);
      } catch {
        window.localStorage.removeItem(REPO_STORAGE_KEY);
      }
    }

    setBootstrapped(true);
  }, []);

  React.useEffect(() => {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      setBootstrapped(true);
      return;
    }

    const parsed = JSON.parse(raw) as { auth0Id?: string; email?: string };
    if (!parsed.auth0Id || !parsed.email) {
      setBootstrapped(true);
      return;
    }

    bootstrapSession(parsed.auth0Id, parsed.email)
      .catch(() => {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      })
      .finally(() => {
        setBootstrapped(true);
      });
  }, [bootstrapSession]);

  React.useEffect(() => {
    if (!workspace?.id) return;
    void refreshMetrics();
  }, [workspace?.id, refreshMetrics]);

  const runFullAnalysis = React.useCallback(
    async (options?: RunAnalysisOptions) => {
      if (isAnalyzing || !workspace?.id || !selectedRepo?.id) return;

      const withModal = options?.withModal ?? true;
      setIsAnalyzing(true);
      if (withModal) setAnalysisModalOpen(true);
      setAnalysisStepIndex(0);

      try {
        const response = await fetch("/api/analysis/run", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: workspace.id, repoId: selectedRepo.id }),
        });

        if (!response.ok) {
          throw new Error("Failed to queue analysis job");
        }

        const { jobId } = (await response.json()) as { jobId: number };
        setAnalysisStepIndex(1);

        let done = false;
        while (!done) {
          await wait(1400);
          const statusResponse = await fetch(`/api/analysis/jobs/${jobId}`, { credentials: "include" });
          if (!statusResponse.ok) {
            throw new Error("Failed to poll analysis status");
          }

          const statusPayload = (await statusResponse.json()) as {
            status: string;
            analysisId: number | null;
            error?: string;
          };

          if (statusPayload.status === "running") {
            setAnalysisStepIndex((current) => Math.min(current + 1, analysisSteps.length - 2));
          }

          if (statusPayload.status === "failed") {
            throw new Error(statusPayload.error ?? "Analysis job failed");
          }

          if (statusPayload.status === "completed") {
            setAnalysisStepIndex(analysisSteps.length - 1);
            done = true;
          }
        }

        await loadAnalysis(workspace.id, selectedRepo.id);
        await refreshMetrics();
      } finally {
        await wait(350);
        setIsAnalyzing(false);
        setAnalysisModalOpen(false);
      }
    },
    [isAnalyzing, selectedRepo?.id, workspace?.id, loadAnalysis, refreshMetrics],
  );

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      user,
      workspace,
      role,
      selectedRepo,
      setSelectedRepo,
      metrics,
      metricsLoading,
      analysisSteps,
      analysisStepIndex,
      analysisModalOpen,
      isAnalyzing,
      latestAnalysis,
      bootstrapped,
      bootstrapSession,
      refreshMetrics,
      runFullAnalysis,
    }),
    [
      user,
      workspace,
      role,
      selectedRepo,
      setSelectedRepo,
      metrics,
      metricsLoading,
      analysisStepIndex,
      analysisModalOpen,
      isAnalyzing,
      latestAnalysis,
      bootstrapped,
      bootstrapSession,
      refreshMetrics,
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

export type { RepoContext };
export { formatRepo };
