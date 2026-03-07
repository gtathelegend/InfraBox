import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useChat() {
  return useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(api.chat.send.path, {
        method: api.chat.send.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      return api.chat.send.responses[200].parse(data);
    },
  });
}
