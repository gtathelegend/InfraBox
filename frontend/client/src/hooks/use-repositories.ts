import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type ConnectRepositoryRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { getAccessToken, getGitHubTokenFromStorage } from "@/lib/auth-token";
import { buildApiUrl } from "@/lib/api-url";

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

export function useRepositories() {
  return useQuery({
    queryKey: [api.repositories.list.path],
    queryFn: async () => {
      const requestUrl = buildApiUrl(api.repositories.list.path);
      const res = await fetch(requestUrl, {
        credentials: "include",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch repositories");
      const data = await res.json();
      return api.repositories.list.responses[200].parse(data);
    },
  });
}

export function useConnectRepository() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ConnectRepositoryRequest) => {
      const requestUrl = buildApiUrl(api.repositories.connect.path);
      const res = await fetch(requestUrl, {
        method: api.repositories.connect.method,
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to connect repository");
      }
      return api.repositories.connect.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.repositories.list.path] });
      toast({
        title: "Repository Connected",
        description: "The repository has been successfully integrated.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Connection Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  });
}
