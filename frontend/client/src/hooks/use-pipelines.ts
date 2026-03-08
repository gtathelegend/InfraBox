import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { getAccessToken, getGitHubTokenFromStorage } from "@/lib/auth-token";
import { buildApiUrl } from "@/lib/api-url";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const githubToken = getGitHubTokenFromStorage();
  if (githubToken) {
    headers["x-github-token"] = githubToken;
  }
  return headers;
}

export function usePipelines() {
  return useQuery({
    queryKey: [api.pipelines.list.path],
    queryFn: async () => {
      const requestUrl = buildApiUrl(api.pipelines.list.path);
      const res = await fetch(requestUrl, {
        credentials: "include",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch pipelines");
      const data = await res.json();
      return api.pipelines.list.responses[200].parse(data);
    },
  });
}

export function usePipeline(id: string) {
  return useQuery({
    queryKey: [api.pipelines.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.pipelines.get.path, { id });
      const requestUrl = buildApiUrl(url);
      const res = await fetch(requestUrl, {
        credentials: "include",
        headers: await authHeaders(),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch pipeline details");
      const data = await res.json();
      return api.pipelines.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}
