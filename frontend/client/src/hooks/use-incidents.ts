import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { getAccessToken, getGitHubTokenFromStorage } from "@/lib/auth-token";

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const githubToken = getGitHubTokenFromStorage();
  if (githubToken) {
    headers["x-github-token"] = githubToken;
  }
  return headers;
}

export function useIncidents() {
  return useQuery({
    queryKey: [api.incidents.list.path],
    queryFn: async () => {
      const res = await fetch(api.incidents.list.path, {
        credentials: "include",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch incidents");
      const data = await res.json();
      return api.incidents.list.responses[200].parse(data);
    },
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.incidents.resolve.path, { id });
      const res = await fetch(url, {
        method: api.incidents.resolve.method,
        headers: await authHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to resolve incident");
      }
      return api.incidents.resolve.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.incidents.list.path] });
      toast({
        title: "AI Agent Dispatched",
        description: "The autonomous agent is resolving the incident.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  });
}
