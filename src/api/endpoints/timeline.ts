import { get } from "../client";
import type { TimelineEvent } from "@/types/api";

export function listTimeline(params?: {
  start_date?: string;
  end_date?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
  order_by?: "event_timestamp" | "created_at";
}) {
  return get<{ events: TimelineEvent[] }>("/timeline", params as Record<string, string | number>);
}

export function getTimelineById(id: string) {
  return get<{ event: TimelineEvent }>(`/timeline/${encodeURIComponent(id)}`);
}
