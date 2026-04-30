import { useState } from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ListSkeleton,
  QueryErrorAlert,
} from "@/components/shared/query_status";
import {
  useAdminFeedbackPreflight,
  useFindFeedbackByCommit,
  usePendingFeedback,
} from "@/hooks/use_feedback_admin";
import { LiveRelativeTime } from "@/components/shared/live_relative_time";
import { absoluteDateTime, shortId } from "@/lib/humanize";
import { showBackgroundQueryRefresh, showInitialQuerySkeleton } from "@/lib/query_loading";
import { QueryRefreshIndicator } from "@/components/shared/query_refresh_indicator";

/**
 * Blobs-order pending queue surfaced via the local
 * `/admin/feedback/pending` proxy. In hosted mode the server forwards to
 * agent.neotoma.io; in self-contained local mode the server reads
 * directly from the on-disk JSON feedback store.
 */
export function PendingQueue() {
  const pending = usePendingFeedback({ limit: 50 });
  const preflight = useAdminFeedbackPreflight();
  const localMode = preflight.data?.mode === "local";

  if (showInitialQuerySkeleton(pending)) return <ListSkeleton rows={4} />;
  if (pending.error) {
    return (
      <QueryErrorAlert title="Could not load pending queue">
        {pending.error.message}
      </QueryErrorAlert>
    );
  }

  const items = Array.isArray(pending.data?.items) ? pending.data.items : [];
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        {localMode ? (
          <>No pending items in the local feedback store. Triage queue is clear.</>
        ) : (
          <>
            No pending items from <code>agent.neotoma.io</code>. Triage queue is
            clear.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showBackgroundQueryRefresh(pending) ? (
        <div className="flex justify-end">
          <QueryRefreshIndicator />
        </div>
      ) : null}
    <ul className="space-y-2">
      {items.map((raw, idx) => (
        <PendingRow key={pendingKey(raw, idx)} item={raw} />
      ))}
    </ul>
    </div>
  );
}

function pendingKey(item: Record<string, unknown>, idx: number): string {
  const id = typeof item.id === "string" ? item.id : null;
  if (id) return id;
  const fid = typeof item.feedback_id === "string" ? item.feedback_id : null;
  if (fid) return fid;
  return `idx-${idx}`;
}

function PendingRow({ item }: { item: Record<string, unknown> }) {
  const id = typeof item.id === "string" ? item.id : undefined;
  const feedbackId = typeof item.feedback_id === "string" ? item.feedback_id : id;
  const title =
    typeof item.title === "string" && item.title.trim().length > 0
      ? item.title
      : feedbackId
      ? `Feedback ${shortId(feedbackId, 8)}`
      : "Untitled feedback";
  const kind = typeof item.kind === "string" ? item.kind : null;
  const status = typeof item.status === "string" ? item.status : null;
  const submittedAt =
    typeof item.submitted_at === "string" ? item.submitted_at : null;

  return (
    <li className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{title}</span>
            {kind ? (
              <Badge variant="outline" className="font-normal">
                {kind}
              </Badge>
            ) : null}
            {status ? (
              <Badge variant="secondary" className="font-normal">
                {status}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {feedbackId ? (
              <code className="font-mono">{shortId(feedbackId, 14)}</code>
            ) : null}
            {submittedAt ? (
              <span className="ml-2 inline-flex flex-wrap items-center gap-x-1" title={absoluteDateTime(submittedAt)}>
                · submitted <LiveRelativeTime iso={submittedAt} title={false} />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Find-by-commit-sha panel. Drives the admin `by_commit` proxy which
 * returns the feedback rows referencing the given commit — the post-
 * release "did any fix-verification land?" ritual.
 */
export function FindByCommitPanel() {
  const [input, setInput] = useState("");
  const [sha, setSha] = useState<string | null>(null);
  const query = useFindFeedbackByCommit(sha);

  function handleSearch() {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    setSha(trimmed);
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <header className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold">Find feedback by commit SHA</h3>
      </header>
      <div className="flex gap-2">
        <Label htmlFor="find-by-commit" className="sr-only">
          Commit SHA
        </Label>
        <Input
          id="find-by-commit"
          placeholder="deadbeef…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          className="h-9 font-mono text-xs"
        />
        <Button variant="outline" onClick={handleSearch} disabled={input.trim().length === 0}>
          Search
        </Button>
      </div>
      {sha ? (
        <div className="text-sm">
          {showInitialQuerySkeleton(query) ? (
            <p className="inline-flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Searching…
            </p>
          ) : query.error ? (
            <p className="inline-flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {query.error.message}
            </p>
          ) : (
            <div className="space-y-2">
              {showBackgroundQueryRefresh(query) ? (
                <div className="flex justify-end">
                  <QueryRefreshIndicator />
                </div>
              ) : null}
              <pre className="overflow-x-auto rounded bg-muted/40 p-3 text-xs">
                {JSON.stringify(query.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
