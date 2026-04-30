import { useMemo } from "react";
import { Clock } from "lucide-react";
import { useEntityObservations } from "@/hooks/use_entities";
import { LiveRelativeTime } from "@/components/shared/live_relative_time";
import { absoluteDateTime } from "@/lib/humanize";
import { cn } from "@/lib/utils";
import { showBackgroundQueryRefresh, showInitialQuerySkeleton } from "@/lib/query_loading";
import type { Observation } from "@/types/api";

/**
 * Subset of neotoma_feedback fields that render cleanly in a transition
 * timeline. Any other field that appears on an observation is still
 * summarised, just without a humanised label.
 */
const TIMELINE_FIELDS: Record<string, string> = {
  status: "Status",
  classification: "Classification",
  resolution_confidence: "Resolution confidence",
  duplicate_of_feedback_id: "Duplicate of",
  regression_candidate: "Regression candidate",
  triage_notes: "Triage notes",
  notes_markdown: "Notes",
  github_issue_urls: "Issue URLs",
  pull_request_urls: "PR URLs",
  commit_shas: "Commits",
  hit_count: "Hit count",
  regression_count: "Regression count",
  next_check_suggested_at: "Next check",
  upgrade_guidance: "Upgrade guidance",
  verifications: "Verifications",
  verification_count_by_outcome: "Verification counts",
  superseded_by_version: "Superseded by",
};

function summariseValue(value: unknown): string {
  if (value == null) return "cleared";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return "cleared";
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json.length > 120 ? `${json.slice(0, 117)}…` : json;
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

interface TimelineEvent {
  observationId: string;
  observedAt: string;
  entries: { key: string; label: string; summary: string }[];
}

function extractEvents(observations: Observation[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const obs of observations) {
    const fields = obs.fields ?? {};
    const entries = Object.entries(fields)
      .filter(([k]) => k !== "last_activity_at" && k !== "status_updated_at")
      .map(([k, v]) => ({
        key: k,
        label: TIMELINE_FIELDS[k] ?? humanizeKey(k),
        summary: summariseValue(v),
      }));
    if (entries.length === 0) continue;
    events.push({
      observationId: obs.id,
      observedAt: obs.observed_at ?? "",
      entries,
    });
  }
  events.sort((a, b) => {
    const ta = Date.parse(a.observedAt);
    const tb = Date.parse(b.observedAt);
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  return events;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FeedbackTimeline({ entityId }: { entityId: string }) {
  const query = useEntityObservations(entityId);
  const observations = query.data?.observations ?? [];
  const events = useMemo(() => extractEvents(observations), [observations]);

  if (showInitialQuerySkeleton(query)) {
    return (
      <p className="text-sm text-muted-foreground">Loading observation history…</p>
    );
  }
  if (query.error) {
    return (
      <p className="text-sm text-rose-600 dark:text-rose-400">
        Could not load observation history: {query.error.message}
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No observation history recorded for this record yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-4">
      {showBackgroundQueryRefresh(query) ? (
        <li className="text-xs text-muted-foreground">Updating observation history…</li>
      ) : null}
      {events.map((event) => (
        <li key={event.observationId} className="relative">
          <span
            className={cn(
              "absolute -left-[1.3125rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary",
            )}
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            <time dateTime={event.observedAt} title={absoluteDateTime(event.observedAt)}>
              {event.observedAt ? <LiveRelativeTime iso={event.observedAt} title={false} /> : "Unknown time"}
            </time>
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {event.entries.map((entry) => (
              <li key={entry.key} className="flex flex-wrap gap-x-2">
                <span className="font-medium text-muted-foreground">{entry.label}:</span>
                <span className="min-w-0 break-words">{entry.summary}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
