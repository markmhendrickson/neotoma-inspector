import { useQuery } from "@tanstack/react-query";
import { isApiUrlConfigured } from "@/api/client";
import { listTimeline, getTimelineById } from "@/api/endpoints/timeline";

export function useTimeline(params?: {
  start_date?: string;
  end_date?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
  order_by?: "event_timestamp" | "created_at";
}) {
  return useQuery({
    queryKey: ["timeline", params],
    queryFn: () => listTimeline(params),
    placeholderData: (prev) => prev,
    enabled: isApiUrlConfigured(),
  });
}

export function useTimelineEvent(id: string | undefined) {
  return useQuery({
    queryKey: ["timeline-event", id],
    queryFn: () => getTimelineById(id!),
    enabled: isApiUrlConfigured() && !!id,
  });
}
