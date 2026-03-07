import apiClient from "./apiClient";

export interface AssistantQueryRequest {
  workspaceId: string;
  query: string;
}

export interface AssistantQueryResponse {
  message?: string;
  answer: string;
  detectedIntent?: string;
  intentConfidence?: number;
  supportingData?: Record<string, string | number | boolean | null>;
  conversationId?: string;
}

const assistantService = {
  async query(payload: AssistantQueryRequest): Promise<AssistantQueryResponse> {
    const response = await apiClient.post<AssistantQueryResponse>("/api/assistant/query", payload);
    return response.data;
  },
};

export default assistantService;
