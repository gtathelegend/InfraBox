import apiClient from "./apiClient";

export interface Incident {
  id: number;
  workspaceId: number;
  title: string;
  severity: "high" | "medium" | "low" | string;
  status: "open" | "resolved" | string;
  component: string;
  description: string;
  suggestedAction: string | null;
  createdAt: string | null;
}

export interface SimulationMetrics {
  repo: string;
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
  errorRate: number;
  traffic: number;
  cloudCost?: number;
  timestamp?: string;
}

const monitoringService = {
  async getIncidents(): Promise<Incident[]> {
    const response = await apiClient.get<Incident[]>("/api/incidents");
    return response.data;
  },

  async resolveIncident(id: number): Promise<Incident> {
    const response = await apiClient.post<Incident>(`/api/incidents/${id}/resolve`);
    return response.data;
  },

  async getSimulationMetrics(repo: string): Promise<SimulationMetrics> {
    const response = await apiClient.get<SimulationMetrics>("/api/simulation", {
      params: { repo },
    });
    return response.data;
  },

  async getSystemMetrics(workspaceId?: string): Promise<SystemMetrics> {
    const response = await apiClient.get<SystemMetrics>("/api/monitoring/metrics", {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return response.data;
  },
};

export default monitoringService;
