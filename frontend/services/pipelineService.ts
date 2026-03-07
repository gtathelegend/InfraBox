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

export interface PipelineGraphNode {
  id: string;
}

export interface PipelineGraphEdge {
  source: string;
  target: string;
}

export interface PipelineGraphResponse {
  nodes: PipelineGraphNode[];
  edges: PipelineGraphEdge[];
}

function isPipelineGraphResponse(payload: unknown): payload is PipelineGraphResponse {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as { nodes?: unknown; edges?: unknown };
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
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

  async getPipelineGraph(repoId: string): Promise<PipelineGraphResponse> {
    const response = await apiClient.get<
      | PipelineGraphResponse
      | {
          pipelines?: Array<{ stages?: string[] | string }>;
        }
    >(`/api/pipeline/${repoId}`);
    const payload: unknown = response.data;

    if (isPipelineGraphResponse(payload)) {
      const graph = payload;
      return {
        nodes: graph.nodes,
        edges: graph.edges ?? [],
      };
    }

    const stagesRaw = (payload as { pipelines?: Array<{ stages?: string[] | string }> })
      .pipelines?.[0]?.stages;
    const stages = Array.isArray(stagesRaw)
      ? stagesRaw
      : typeof stagesRaw === "string"
        ? stagesRaw
            .split(",")
            .map((stage) => stage.trim())
            .filter(Boolean)
        : [];

    const nodes = stages.map((stage) => ({ id: stage }));
    const edges = stages.slice(0, -1).map((stage, index) => ({
      source: stage,
      target: stages[index + 1],
    }));

    return { nodes, edges };
  },
};

export default pipelineService;
