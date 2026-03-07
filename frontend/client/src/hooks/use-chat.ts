import { useMutation } from "@tanstack/react-query";
import assistantService, { type AssistantQueryResponse } from "@services/assistantService";

type ChatPayload = {
  workspaceId: string;
  query: string;
};

export function useChat() {
  return useMutation({
    mutationFn: async (payload: ChatPayload): Promise<AssistantQueryResponse> => {
      return assistantService.query(payload);
    },
  });
}
