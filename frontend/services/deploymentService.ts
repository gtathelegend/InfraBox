import apiClient from "./apiClient";
import type { Pipeline } from "./pipelineService";

export interface AnalysisResult {
  repo: string;
  architectureScore: number;
  riskScore: number;
  deploymentConfidence: number;
}

export interface AnalyzeResponse {
  status: "queued" | string;
  repo: string;
  message: string;
}

export interface DeploymentRunResponse {
  message: string;
  deploymentId: string;
  deploymentStatus: string;
  repositoryId: number | null;
  targetEnvironment: string;
  updatedAt: string;
}

const deploymentService = {
  async queueRepositoryAnalysis(repo: string): Promise<AnalyzeResponse> {
    const response = await apiClient.post<AnalyzeResponse>("/analyze", { repo });
    return response.data;
  },

  async getAnalysis(repo: string): Promise<AnalysisResult> {
    const response = await apiClient.get<AnalysisResult>("/api/analysis", {
      params: { repo },
    });
    return response.data;
  },

  async getDeploymentTimeline(): Promise<Pipeline[]> {
    const response = await apiClient.get<Pipeline[]>("/api/pipelines");
    return response.data;
  },

  async triggerDeployment(payload: {
    repositoryId?: number;
    targetEnvironment?: string;
  }): Promise<DeploymentRunResponse> {
    const response = await apiClient.post<DeploymentRunResponse>("/api/deploy/run", payload);
    return response.data;
  },
};

export default deploymentService;
