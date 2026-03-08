import apiClient from "./apiClient";

export interface AssistantReply {
  reply: string;
}

const assistantService = {
  async sendMessage(message: string): Promise<AssistantReply> {
    const response = await apiClient.post<AssistantReply>("/api/chat", { message });
    return response.data;
  },
};

export default assistantService;
