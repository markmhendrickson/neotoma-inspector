import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { healthCheck, getServerInfo, getMe, healthCheckSnapshots } from "@/api/endpoints/infra";

export function useHealthCheck() {
  return useQuery({ queryKey: ["health"], queryFn: healthCheck, refetchInterval: 60_000 });
}

export function useServerInfo() {
  return useQuery({ queryKey: ["server-info"], queryFn: getServerInfo });
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: getMe, retry: false });
}

export function useHealthCheckSnapshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (autoFix: boolean) => healthCheckSnapshots(autoFix),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stats"] }),
  });
}
