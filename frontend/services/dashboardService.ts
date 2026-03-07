import apiClient from "./apiClient";

export interface RepositorySummary {
  id?: string;
  name?: string;
  fullName?: string;
  provider?: string;
  status?: string;
  [key: string]: unknown;
}

export interface PipelineSummary {
  id?: string;
  name?: string;
  status?: string;
  confidenceScore?: number;
  costPrediction?: number;
  createdAt?: string;
  [key: string]: unknown;
}

export interface DeploymentHistoryItem {
  _id?: string;
  deploymentId?: string;
  repositoryId?: string;
  deploymentStatus?: string;
  targetEnvironment?: string;
  startedAt?: string;
  endedAt?: string;
  [key: string]: unknown;
}

export interface DashboardOverview {
  services?: Array<{
    serviceId: string;
    status: string;
    cpuUsage: number;
    memoryUsage: number;
    latency: number;
    errorRate: number;
    traffic: number;
    lastUpdated: string;
  }>;
  metrics?: {
    cpuUsageGraph?: Array<{ timestamp: string; value: number }>;
    memoryUsageGraph?: Array<{ timestamp: string; value: number }>;
    latencyTrends?: Array<{ timestamp: string; value: number }>;
    errorRateTrends?: Array<{ timestamp: string; value: number }>;
    trafficTrends?: Array<{ timestamp: string; value: number }>;
  };
  activeAlerts?: Array<{ type?: string; severity?: string; message?: string }>;
  deployments?: DeploymentHistoryItem[];
}

export interface MonitoringMetrics {
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
  errorRate: number;
  traffic: number;
  cloudCost: number;
  timestamp: string;
}

export interface DashboardApiPayload {
  repositories: RepositorySummary[];
  pipelines: PipelineSummary[];
  deploymentHistory: DeploymentHistoryItem[];
  overview: DashboardOverview | null;
  systemMetrics: MonitoringMetrics | null;
  alerts: Array<{ type?: string; severity?: string; message?: string }>;
}

const dashboardService = {
  async getRepositories(workspaceId?: string): Promise<RepositorySummary[]> {
    try {
      const response = await apiClient.get<RepositorySummary[]>("/api/repos", {
        params: workspaceId ? { workspaceId } : undefined,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      const fallback = await apiClient.get<RepositorySummary[]>("/api/repositories");
      return Array.isArray(fallback.data) ? fallback.data : [];
    }
  },

  async getPipelines(repoId?: string): Promise<PipelineSummary[]> {
    try {
      const endpoint = repoId ? `/api/pipeline/${repoId}` : "/api/pipeline";
      const response = await apiClient.get<{ pipelines?: PipelineSummary[] } | PipelineSummary[]>(
        endpoint,
      );

      if (Array.isArray(response.data)) return response.data;
      return Array.isArray(response.data.pipelines) ? response.data.pipelines : [];
    } catch {
      const fallback = await apiClient.get<PipelineSummary[]>("/api/pipelines");
      return Array.isArray(fallback.data) ? fallback.data : [];
    }
  },

  async getDeploymentHistory(workspaceId?: string): Promise<DeploymentHistoryItem[]> {
    try {
      const response = await apiClient.get<{ deployments?: DeploymentHistoryItem[] }>(
        "/api/deploy/history",
        {
          params: workspaceId ? { workspaceId } : undefined,
        },
      );
      return Array.isArray(response.data.deployments) ? response.data.deployments : [];
    } catch {
      const fallback = await apiClient.get<PipelineSummary[]>("/api/pipelines");
      return fallback.data.map((item) => ({
        deploymentId: String(item.id ?? ""),
        deploymentStatus: item.status,
        startedAt: item.createdAt,
        targetEnvironment: "unknown",
      }));
    }
  },

  async getDashboardOverview(workspaceId?: string): Promise<DashboardOverview | null> {
    const response = await apiClient.get<DashboardOverview>("/api/dashboard/overview", {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return response.data ?? null;
  },

  async getSystemMetrics(workspaceId?: string): Promise<MonitoringMetrics | null> {
    const response = await apiClient.get<MonitoringMetrics>("/api/monitoring/metrics", {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return response.data ?? null;
  },

  async getDashboardData(params?: {
    workspaceId?: string;
    repoId?: string;
  }): Promise<DashboardApiPayload> {
    const workspaceId = params?.workspaceId;
    const repoId = params?.repoId;

    const [repositories, pipelines, deploymentHistory, overview, systemMetrics] =
      await Promise.all([
        this.getRepositories(workspaceId),
        this.getPipelines(repoId),
        this.getDeploymentHistory(workspaceId),
        this.getDashboardOverview(workspaceId),
        this.getSystemMetrics(workspaceId),
      ]);

    return {
      repositories,
      pipelines,
      deploymentHistory,
      overview,
      systemMetrics,
      alerts: overview?.activeAlerts ?? [],
    };
  },
};

export default dashboardService;
