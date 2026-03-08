import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { getAccessToken, getGitHubTokenFromStorage } from "@/lib/auth-token";

export function useChat() {
  return useMutation({
    mutationFn: async (message: string) => {
      const token = await getAccessToken();
      const githubToken = getGitHubTokenFromStorage();
      const res = await fetch(api.chat.send.path, {
        method: api.chat.send.method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(githubToken ? { "x-github-token": githubToken } : {}),
        },
        body: JSON.stringify({ message }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      return api.chat.send.responses[200].parse(data);
    },
  });
}
