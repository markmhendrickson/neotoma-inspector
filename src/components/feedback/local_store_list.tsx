import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  GitPullRequest,
  Hourglass,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ListSkeleton, QueryErrorAlert } from "@/components/shared/query_status";
import { LiveRelativeTime } from "@/components/shared/live_relative_time";
import { useAllFeedback } from "@/hooks/use_feedback_admin";
import { absoluteDateTime, shortId, truncate } from "@/lib/humanize";
import { showBackgroundQueryRefresh, showInitialQuerySkeleton } from "@/lib/query_loading";
import { QueryRefreshIndicator } from "@/components/shared/query_refresh_indicator";
import { cn } from "@/lib/utils";

type RawRecord = Record<string, unknown>;

const STATUS_STYLES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  submitted: { label: "Submitted", variant: "secondary" },
  triaged: { label: "Triaged", variant: "outline" },
  planned: { label: "Planned", variant: "outline" },
  in_progress: {
    label: "In progress",
    variant: "default",
    className: "bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300",
  },
  resolved: {
    label: "Resolved",
    variant: "default",
    className: "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
  },
  duplicate: { label: "Duplicate", variant: "secondary" },
  wait_for_next_release: {
    label: "Awaiting release",
    variant: "outline",
    className: "border-amber-500/50 text-amber-700 dark:text-amber-300",
  },
  wontfix: { label: "Won't fix", variant: "secondary" },
  removed: { label: "Removed", variant: "secondary" },
};

const KIND_LABELS: Record<string, string> = {
  incident: "Incident",
  report: "Report",
  doc_gap: "Doc gap",
  primitive_ask: "Primitive ask",
  contract_discrepancy: "Contract gap",
  fix_verification: "Fix verification",
  schema_coverage_report: "Schema coverage",
};

function str(val: unknown): string | undefined {
  return typeof val === "string" && val.trim().length > 0 ? val : undefined;
}

function strArr(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string" && v.trim().length > 0);
  return [];
}

export function LocalStoreList() {
  const query = useAllFeedback();
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [search, setSearch] = useState("");

  if (showInitialQuerySkeleton(query)) return <ListSkeleton rows={6} />;
  if (query.error) {
    return (
      <QueryErrorAlert title="Could not load local feedback store">
        {query.error.message}
      </QueryErrorAlert>
    );
  }

  const allItems: RawRecord[] = Array.isArray(query.data?.items) ? query.data.items : [];
  const mode = query.data?.mode ?? "unknown";

  const filtered = allItems.filter((item) => {
    if (statusFilter !== "all" && str(item.status) !== statusFilter) return false;
    if (kindFilter !== "all" && str(item.kind) !== kindFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const title = str(item.title)?.toLowerCase() ?? "";
      const body = str(item.body)?.toLowerCase() ?? "";
      const id = str(item.id)?.toLowerCase() ?? "";
      if (!title.includes(q) && !body.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });

  const statuses = [...new Set(allItems.map((i) => str(i.status)).filter(Boolean))] as string[];
  const kinds = [...new Set(allItems.map((i) => str(i.kind)).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      {showBackgroundQueryRefresh(query) ? (
        <div className="flex justify-end">
          <QueryRefreshIndicator />
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Database className="h-4 w-4" aria-hidden />
        <span>
          {allItems.length.toLocaleString()} record{allItems.length === 1 ? "" : "s"} from{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{mode}</code> store
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[10rem] gap-1.5">
          <Label htmlFor="ls-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="ls-status" className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_STYLES[s]?.label ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1.5">
          <Label htmlFor="ls-kind" className="text-xs text-muted-foreground">
            Kind
          </Label>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger id="ls-kind" className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {kinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k] ?? k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[14rem] gap-1.5">
          <Label htmlFor="ls-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <Input
            id="ls-search"
            placeholder="Title, body, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <Separator />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {allItems.length === 0
            ? "No records in the local feedback store yet."
            : "No records match the current filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, idx) => (
            <LocalRecordCard key={str(item.id) ?? `idx-${idx}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function LocalRecordCard({ item }: { item: RawRecord }) {
  const [expanded, setExpanded] = useState(false);
  const id = str(item.id);
  const title = str(item.title) ?? (id ? `Feedback ${shortId(id, 8)}` : "Untitled");
  const status = str(item.status);
  const kind = str(item.kind);
  const classification = str(item.classification);
  const submittedAt = str(item.submitted_at);
  const lastActivity = str(item.last_activity_at);
  const body = str(item.body);
  const errorMessage = str((item.metadata as Record<string, unknown>)?.error_message ?? item.error_message);
  const triageNotes = str(item.triage_notes);
  const regression = item.regression_candidate === true;

  const links = (item.resolution_links ?? {}) as Record<string, unknown>;
  const issueUrls = strArr(links.github_issue_urls);
  const prUrls = strArr(links.pull_request_urls);
  const commitShas = strArr(links.commit_shas);
  const hasResolutionLinks = issueUrls.length + prUrls.length + commitShas.length > 0;

  const staleMs = 7 * 24 * 60 * 60 * 1000;
  const isOpen = status === "submitted" || status === "triaged";
  const activityTs = lastActivity ?? submittedAt;
  const isStale = isOpen && activityTs && Date.now() - Date.parse(activityTs) > staleMs;

  const statusEntry = status ? STATUS_STYLES[status] ?? { label: status, variant: "outline" as const } : null;

  return (
    <details
      className="rounded-lg border bg-card shadow-sm open:ring-1 open:ring-border"
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="inline-block max-w-full truncate text-base font-semibold text-foreground">
                {truncate(title, 160)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {statusEntry ? (
                <Badge variant={statusEntry.variant} className={cn("shrink-0", statusEntry.className)}>
                  {statusEntry.label}
                </Badge>
              ) : null}
              {kind ? (
                <Badge variant="outline" className="shrink-0 font-normal">
                  {KIND_LABELS[kind] ?? kind}
                </Badge>
              ) : null}
              {classification ? (
                <Badge variant="outline" className="font-normal">
                  {classification}
                </Badge>
              ) : null}
              {isStale ? (
                <Badge
                  variant="outline"
                  className="border-orange-500/50 font-normal text-orange-700 dark:text-orange-300"
                >
                  <Hourglass className="mr-1 h-3 w-3" aria-hidden /> Stale
                </Badge>
              ) : null}
              {regression ? (
                <Badge
                  variant="outline"
                  className="border-rose-500/50 font-normal text-rose-700 dark:text-rose-300"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden /> Regression
                </Badge>
              ) : null}
              {activityTs ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      <LiveRelativeTime iso={activityTs} title={false} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{absoluteDateTime(activityTs)}</TooltipContent>
                </Tooltip>
              ) : null}
              {id ? (
                <code className="font-mono text-[10px] opacity-60">{shortId(id, 12)}</code>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {issueUrls.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  {issueUrls.length} issue{issueUrls.length === 1 ? "" : "s"}
                </span>
              ) : null}
              {prUrls.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <GitPullRequest className="h-3.5 w-3.5" aria-hidden />
                  {prUrls.length} PR{prUrls.length === 1 ? "" : "s"}
                </span>
              ) : null}
              {commitShas.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" aria-hidden />
                  {commitShas.length} commit{commitShas.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </summary>

      {expanded ? (
        <div className="space-y-4 border-t px-4 py-4">
          {body ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Body
              </h3>
              <p className="mt-2 whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-sm">
                {body}
              </p>
            </section>
          ) : null}

          {errorMessage ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Error message
              </h3>
              <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-3 text-xs font-mono">
                {errorMessage}
              </pre>
            </section>
          ) : null}

          {triageNotes ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Triage notes
              </h3>
              <div className="mt-2 whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-sm">
                {triageNotes}
              </div>
            </section>
          ) : null}

          {hasResolutionLinks ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resolution links
              </h3>
              <ul className="mt-2 space-y-1.5">
                {issueUrls.map((url) => (
                  <li key={`issue:${url}`} className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-primary hover:underline"
                    >
                      {url}
                    </a>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </li>
                ))}
                {prUrls.map((url) => (
                  <li key={`pr:${url}`} className="flex items-center gap-2 text-sm">
                    <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-primary hover:underline"
                    >
                      {url}
                    </a>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </li>
                ))}
                {commitShas.map((sha) => (
                  <li key={`sha:${sha}`} className="flex items-center gap-2 text-sm">
                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <code className="truncate font-mono text-xs">{sha}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            <MetadataBlock
              title="Identity"
              rows={[
                ["ID", id ? shortId(id, 18) : undefined],
                ["Submitter", str(item.submitter_id) ? shortId(str(item.submitter_id)!, 12) : undefined],
                ["Kind", kind ? (KIND_LABELS[kind] ?? kind) : undefined],
                ["Classification", classification],
              ]}
            />
            <MetadataBlock
              title="Timing"
              rows={[
                ["Submitted", submittedAt ? absoluteDateTime(submittedAt) : undefined],
                ["Status updated", str(item.status_updated_at) ? absoluteDateTime(str(item.status_updated_at)!) : undefined],
                ["Last activity", lastActivity ? absoluteDateTime(lastActivity) : undefined],
                ["Next check", str(item.next_check_suggested_at) ? absoluteDateTime(str(item.next_check_suggested_at)!) : undefined],
              ]}
            />
          </section>
        </div>
      ) : null}
    </details>
  );
}

function MetadataBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string | undefined][];
}) {
  const visible = rows.filter(([, v]) => v != null && v.trim() !== "");
  if (visible.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {visible.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="truncate text-muted-foreground">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
