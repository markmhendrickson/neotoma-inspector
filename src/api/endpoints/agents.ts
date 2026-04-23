import { get } from "../client";
import type {
  AgentDetailResponse,
  AgentRecordsResponse,
  AgentsListResponse,
} from "@/types/api";

export function listAgents() {
  return get<AgentsListResponse>("/agents");
}

export function getAgent(agentKey: string) {
  return get<AgentDetailResponse>(`/agents/${encodeURIComponent(agentKey)}`);
}

export function listAgentRecords(
  agentKey: string,
  params?: { limit?: number; offset?: number },
) {
  return get<AgentRecordsResponse>(
    `/agents/${encodeURIComponent(agentKey)}/records`,
    params as Record<string, string | number> | undefined,
  );
}
