import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type CreateRepositoryRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useRepositories(workspaceId?: number) {
  return useQuery({
    queryKey: [api.repositories.list.path, workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const authToken = typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null;
      const authIdToken = typeof window !== "undefined" ? window.localStorage.getItem("auth_id_token") : null;
      const githubUser =
        typeof window !== "undefined" ? (import.meta.env.VITE_GITHUB_PROFILE as string | undefined) : undefined;

      const query = new URLSearchParams({ workspaceId: String(workspaceId) });
      if (githubUser && githubUser.trim()) {
        query.set("githubUser", githubUser.trim());
      }

      const res = await fetch(`${api.repositories.list.path}?${query.toString()}`, {
        credentials: "include",
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(authIdToken ? { "x-auth-token": authIdToken } : {}),
        },
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
    mutationFn: async (data: CreateRepositoryRequest) => {
      const res = await fetch(api.repositories.connect.path, {
        method: api.repositories.connect.method,
        headers: { "Content-Type": "application/json" },
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
