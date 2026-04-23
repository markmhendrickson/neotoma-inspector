import { get } from "../client";
import type { RecentConversationsResponse } from "@/types/api";

export function listRecentConversations(params?: {
  limit?: number;
  offset?: number;
  activity_after?: string;
  activity_before?: string;
  agent_key?: string;
}) {
  return get<RecentConversationsResponse>(
    "/recent_conversations",
    params as Record<string, string | number | undefined>,
  );
}
