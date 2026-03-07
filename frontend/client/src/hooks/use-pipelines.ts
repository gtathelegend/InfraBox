import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function usePipelines() {
  return useQuery({
    queryKey: [api.pipelines.list.path],
    queryFn: async () => {
      const res = await fetch(api.pipelines.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pipelines");
      const data = await res.json();
      return api.pipelines.list.responses[200].parse(data);
    },
  });
}

export function usePipeline(id: number) {
  return useQuery({
    queryKey: [api.pipelines.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.pipelines.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch pipeline details");
      const data = await res.json();
      return api.pipelines.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}
