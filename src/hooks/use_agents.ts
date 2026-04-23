import { useQuery } from "@tanstack/react-query";
import {
  getAgent,
  listAgentRecords,
  listAgents,
} from "@/api/endpoints/agents";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => listAgents(),
    placeholderData: (prev) => prev,
  });
}

export function useAgent(agentKey: string | undefined) {
  return useQuery({
    queryKey: ["agents", agentKey],
    queryFn: () => getAgent(agentKey as string),
    enabled: Boolean(agentKey),
  });
}

export function useAgentRecords(
  agentKey: string | undefined,
  params?: { limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ["agents", agentKey, "records", params],
    queryFn: () => listAgentRecords(agentKey as string, params),
    enabled: Boolean(agentKey),
    placeholderData: (prev) => prev,
  });
}
