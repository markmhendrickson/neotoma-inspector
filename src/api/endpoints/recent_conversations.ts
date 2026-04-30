import { get } from "../client";
import type { RecentConversationItem, RecentConversationsResponse } from "@/types/api";

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

export function getRecentConversation(conversationId: string) {
  return get<RecentConversationItem>(
    `/recent_conversations/${encodeURIComponent(conversationId)}`,
  );
}
