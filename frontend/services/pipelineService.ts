import apiClient from "./apiClient";

export type PipelineStatus = "success" | "failed" | "running";

export interface Pipeline {
  id: number;
  repositoryId: number;
  name: string;
  status: PipelineStatus;
  confidenceScore: number | null;
  costPrediction: number | null;
  stages: string[] | string;
  createdAt: string | null;
}

export interface PipelineOverview {
  repo: string;
  stages: string[];
  slowestStage: string;
  failureProbability: number;
}

const pipelineService = {
  async getPipelines(): Promise<Pipeline[]> {
    const response = await apiClient.get<Pipeline[]>("/api/pipelines");
    return response.data;
  },

  async getPipelineById(id: number): Promise<Pipeline> {
    const response = await apiClient.get<Pipeline>(`/api/pipelines/${id}`);
    return response.data;
  },

  async getPipelineOverview(repo: string): Promise<PipelineOverview> {
    const response = await apiClient.get<PipelineOverview>("/api/pipeline", {
      params: { repo },
    });
    return response.data;
  },
};

export default pipelineService;
