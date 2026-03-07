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
  analysisSteps: string[];
  analysisStepIndex: number;
  analysisModalOpen: boolean;
  isAnalyzing: boolean;
  runFullAnalysis: (options?: RunAnalysisOptions) => Promise<void>;
};

const STORAGE_KEY = "infrabox.selectedRepo";

const initialMetrics: DashboardMetrics = {
  deploymentConfidenceScore: 82,
  activeRepositories: 12,
  simulationStatus: "Running",
  infrastructureHealth: 96,
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

  const runFullAnalysis = React.useCallback(
    async (options?: RunAnalysisOptions) => {
      if (isAnalyzing) return;

      const withModal = options?.withModal ?? true;
      setIsAnalyzing(true);
      setAnalysisStepIndex(0);
      if (withModal) setAnalysisModalOpen(true);

      for (let index = 0; index < analysisSteps.length; index += 1) {
        setAnalysisStepIndex(index);
        await wait(650);
      }

      setMetrics({
        deploymentConfidenceScore: 78 + Math.floor(Math.random() * 18),
        activeRepositories: 9 + Math.floor(Math.random() * 6),
        simulationStatus: Math.random() > 0.4 ? "Completed" : "Running",
        infrastructureHealth: 90 + Math.floor(Math.random() * 9),
      });

      await wait(500);
      setIsAnalyzing(false);
      if (withModal) setAnalysisModalOpen(false);
    },
    [isAnalyzing],
  );

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      selectedRepo,
      setSelectedRepo,
      metrics,
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
