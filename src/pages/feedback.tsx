import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  ExternalLink,
  FileText,
  GitBranch,
  GitPullRequest,
  Hourglass,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { PageShell } from "@/components/layout/page_shell";
import { ListSkeleton, QueryErrorAlert } from "@/components/shared/query_status";
import { EntityLink, EntityOpenIconLink } from "@/components/shared/entity_link";
import { FeedbackTimeline } from "@/components/feedback/feedback_timeline";
import { ScratchBlock } from "@/components/feedback/scratch_block";
import {
  FindByCommitPanel,
  PendingQueue,
} from "@/components/feedback/pending_queue";
import { LocalStoreList } from "@/components/feedback/local_store_list";
import { FeedbackStoreSyncPanel } from "@/components/feedback/feedback_store_sync_panel";
import {
  PublishDialog,
  type PublishDraft,
} from "@/components/feedback/publish_dialog";
import { isApiUrlConfigured } from "@/api/client";
import { activateFeedbackAdminSession } from "@/api/endpoints/feedback_admin";
import { useAdminFeedbackPreflight } from "@/hooks/use_feedback_admin";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNeotomaFeedback } from "@/hooks/use_neotoma_feedback";
import { useSessionIdentity } from "@/hooks/use_session_identity";
import { LiveRelativeTime } from "@/components/shared/live_relative_time";
import { absoluteDateTime, shortId, truncate } from "@/lib/humanize";
import {
  type FeedbackSnapshot,
  type FeedbackSort,
  type StatusBucket,
  type SummaryStats,
  FEEDBACK_MINE_STORAGE_KEY,
  activityTimestamp,
  arrayOfStrings,
  computeBucketCounts,
  computeSummary,
  entityRowId,
  feedbackComparator,
  hasScratchAnnotations,
  isStale,
  matchesBucket,
  matchesSubmitter,
  parseUpgradeGuidance,
  snapshotOf,
  uniqueSubmitterIds,
} from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { showBackgroundQueryRefresh, showInitialQuerySkeleton } from "@/lib/query_loading";
import { QueryRefreshIndicator } from "@/components/shared/query_refresh_indicator";
import type { EntitySnapshot } from "@/types/api";

const PAGE_SIZE = 25;

const STATUS_BUCKETS: { value: StatusBucket; label: string; help: string }[] = [
  {
    value: "all",
    label: "All",
    help: "Every feedback record mirrored from the pipeline.",
  },
  {
    value: "open",
    label: "Open",
    help: "Submitted or triaged — waiting on a maintainer or agent action.",
  },
  {
    value: "stale",
    label: "Stale",
    help: "Open items with no activity in the last 7 days. Maintainer triage queue.",
  },
  {
    value: "in_progress",
    label: "In progress",
    help: "Planned or in-progress items with work underway.",
  },
  {
    value: "resolved",
    label: "Resolved",
    help: "Resolved, duplicate, or shipped fixes awaiting verification.",
  },
  {
    value: "inactive",
    label: "Inactive",
    help: "Wait-for-next-release, wontfix, or removed records.",
  },
];

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

const SORT_LABELS: { value: FeedbackSort; label: string }[] = [
  { value: "recent_activity", label: "Recent activity" },
  { value: "oldest_open", label: "Oldest open" },
  { value: "most_hits", label: "Most hits" },
  { value: "most_regressions", label: "Most regressions" },
];

const VALID_BUCKETS: readonly StatusBucket[] = [
  "all",
  "open",
  "stale",
  "in_progress",
  "resolved",
  "inactive",
] as const;

const VALID_SORTS: readonly FeedbackSort[] = [
  "recent_activity",
  "oldest_open",
  "most_hits",
  "most_regressions",
] as const;

function feedbackTitle(entity: EntitySnapshot, snap: FeedbackSnapshot): string {
  const raw =
    snap.title?.trim() ||
    entity.canonical_name?.trim() ||
    (snap.feedback_id ? `Feedback ${shortId(snap.feedback_id, 8)}` : "") ||
    shortId(entityRowId(entity), 10);
  return truncate(raw, 160);
}

/**
 * Render an agent-friendly countdown for `next_check_suggested_at`. Used
 * as a hint to reporters: when the next pipeline poll is expected.
 * Returns null when the timestamp is missing, past, or unparseable.
 */
function formatNextCheckCountdown(ts: string | undefined, now: number): string | null {
  if (!ts) return null;
  const target = Date.parse(ts);
  if (!Number.isFinite(target)) return null;
  const delta = target - now;
  if (delta <= 0) return "due now";
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return `~${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `~${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `~${hr}h`;
  const day = Math.floor(hr / 24);
  return `~${day}d`;
}

function submitterLabel(snap: FeedbackSnapshot): string {
  const bits: string[] = [];
  if (snap.client_name) bits.push(snap.client_name);
  if (snap.client_version) bits.push(snap.client_version);
  if (snap.neotoma_version) bits.push(`neotoma ${snap.neotoma_version}`);
  if (bits.length === 0 && snap.submitter_id) bits.push(shortId(snap.submitter_id, 8));
  return bits.join(" · ");
}

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  const entry = STATUS_STYLES[status] ?? {
    label: status,
    variant: "outline" as const,
  };
  return (
    <Badge variant={entry.variant} className={cn("shrink-0", entry.className)}>
      {entry.label}
    </Badge>
  );
}

function KindBadge({ kind }: { kind: string | undefined }) {
  if (!kind) return null;
  return (
    <Badge variant="outline" className="shrink-0 font-normal">
      {KIND_LABELS[kind] ?? kind}
    </Badge>
  );
}

function readMineStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(FEEDBACK_MINE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeMineStorage(val: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (val && val.trim().length > 0) {
      window.localStorage.setItem(FEEDBACK_MINE_STORAGE_KEY, val);
    } else {
      window.localStorage.removeItem(FEEDBACK_MINE_STORAGE_KEY);
    }
  } catch {
    /* ignore quota/disabled errors */
  }
}

export default function FeedbackPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlBucket = searchParams.get("bucket") as StatusBucket | null;
  const urlKind = searchParams.get("kind");
  const urlSearch = searchParams.get("q") ?? "";
  const urlSubmitter = searchParams.get("submitter");
  const urlMine = searchParams.get("mine") === "1";
  const urlHasScratch = searchParams.get("scratch") === "1";
  const urlSort = searchParams.get("sort") as FeedbackSort | null;

  const [bucket, setBucket] = useState<StatusBucket>(
    urlBucket && VALID_BUCKETS.includes(urlBucket) ? urlBucket : "all",
  );
  const [kindFilter, setKindFilter] = useState<string>(urlKind || "all");
  const [search, setSearch] = useState(urlSearch);
  const [submitterFilter, setSubmitterFilter] = useState<string>(urlSubmitter || "all");
  const [mineOnly, setMineOnly] = useState<boolean>(urlMine);
  const [hasScratchOnly, setHasScratchOnly] = useState<boolean>(urlHasScratch);
  const [sort, setSort] = useState<FeedbackSort>(
    urlSort && VALID_SORTS.includes(urlSort) ? urlSort : "recent_activity",
  );
  const [offset, setOffset] = useState(0);

  const { identity } = useSessionIdentity();
  const [mineStorageValue, setMineStorageValue] = useState<string | null>(() =>
    readMineStorage(),
  );
  const effectiveMineId =
    identity?.submitterCandidate ?? mineStorageValue ?? null;

  const adminPreflight = useAdminFeedbackPreflight();
  const adminProxyConfigured = adminPreflight.data?.configured === true;
  const adminMode: "hosted" | "local" | "disabled" =
    adminPreflight.data?.mode ??
    (adminProxyConfigured ? "hosted" : "disabled");
  const eligibleTier =
    identity?.tier === "hardware" ||
    identity?.tier === "software" ||
    identity?.tier === "operator_attested";
  const adminSessionActive = adminPreflight.data?.admin_session?.active === true;
  const canPublish =
    adminProxyConfigured && (eligibleTier || adminSessionActive);

  useEffect(() => {
    const ch = searchParams.get("feedback_unlock_challenge")?.trim();
    if (!ch || !isApiUrlConfigured()) return;
    let cancelled = false;
    void (async () => {
      try {
        await activateFeedbackAdminSession(ch);
        if (cancelled) return;
        await qc.invalidateQueries({ queryKey: ["admin-feedback-preflight"] });
        const next = new URLSearchParams(searchParams);
        next.delete("feedback_unlock_challenge");
        setSearchParams(next, { replace: true });
      } catch {
        /* ignore — user can retry or use manual GET in browser */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, qc]);

  const rawTab = searchParams.get("tab");
  const urlTab: "all" | "mirrored" | "pending" =
    rawTab === "pending" ? "pending" : rawTab === "mirrored" ? "mirrored" : "all";
  const [topTab, setTopTab] = useState<"all" | "mirrored" | "pending">(urlTab);

  const [publishState, setPublishState] = useState<{
    entity: EntitySnapshot;
    feedbackId: string;
    draft: PublishDraft;
  } | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const apply = (key: string, value: string | null | undefined) => {
      if (value && value !== "all" && value !== "") next.set(key, value);
      else next.delete(key);
    };
    apply("bucket", bucket === "all" ? null : bucket);
    apply("kind", kindFilter === "all" ? null : kindFilter);
    apply("q", search.trim() || null);
    apply("submitter", submitterFilter === "all" ? null : submitterFilter);
    apply("sort", sort === "recent_activity" ? null : sort);
    if (mineOnly) next.set("mine", "1");
    else next.delete("mine");
    if (hasScratchOnly) next.set("scratch", "1");
    else next.delete("scratch");
    if (topTab === "pending") next.set("tab", "pending");
    else if (topTab === "mirrored") next.set("tab", "mirrored");
    else next.delete("tab");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [bucket, kindFilter, search, submitterFilter, mineOnly, hasScratchOnly, sort, topTab, searchParams, setSearchParams]);

  const query = useNeotomaFeedback({
    search: search.trim() || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const entities = query.data?.entities ?? [];
  const total = query.data?.total ?? 0;
  const now = Date.now();

  const submitterForFilter = useMemo(() => {
    if (submitterFilter !== "all") return submitterFilter;
    if (mineOnly) return effectiveMineId;
    return null;
  }, [submitterFilter, mineOnly, effectiveMineId]);

  const filtered = useMemo(() => {
    const result = entities.filter((entity) => {
      if (!matchesBucket(entity, bucket, now)) return false;
      const snap = snapshotOf(entity);
      if (kindFilter !== "all" && (snap.kind ?? "") !== kindFilter) return false;
      if (!matchesSubmitter(entity, submitterForFilter)) return false;
      if (hasScratchOnly && !hasScratchAnnotations(entity)) return false;
      return true;
    });
    result.sort(feedbackComparator(sort));
    return result;
  }, [entities, bucket, kindFilter, submitterForFilter, hasScratchOnly, sort, now]);

  const kindOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entity of entities) {
      const kind = snapshotOf(entity).kind;
      if (kind && !seen.has(kind)) {
        seen.set(kind, KIND_LABELS[kind] ?? kind);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [entities]);

  const submitterOptions = useMemo(() => uniqueSubmitterIds(entities), [entities]);

  const summary = useMemo<SummaryStats>(() => computeSummary(entities, now), [entities, now]);
  const bucketCounts = useMemo(() => computeBucketCounts(entities, now), [entities, now]);

  const pipelineLabel =
    adminMode === "local"
      ? "local feedback store"
      : "agent.neotoma.io pipeline";
  const countCopy = `${total.toLocaleString()} record${total === 1 ? "" : "s"}`;
  const description = showInitialQuerySkeleton(query)
    ? `Loading feedback records mirrored from the ${pipelineLabel}…`
    : canPublish
    ? adminMode === "local"
      ? `Local maintainer triage surface. ${countCopy} in the self-contained pipeline; status writes update the local store and mirror into the neotoma_feedback entity graph.`
      : `Maintainer triage surface. ${countCopy} mirrored; status writes propagate to agent.neotoma.io via the admin proxy.`
    : adminMode === "local"
    ? `${countCopy} in the local self-contained feedback pipeline.`
    : `${countCopy} mirrored from the agent.neotoma.io pipeline.`;

  const handlePromote = useCallback(
    (entity: EntitySnapshot, feedbackId: string, draft: PublishDraft) => {
      if (!canPublish) return;
      setPublishState({ entity, feedbackId, draft });
    },
    [canPublish],
  );

  const handleMineToggle = useCallback(
    (checked: boolean) => {
      setMineOnly(checked);
      setOffset(0);
      if (checked && !identity?.submitterCandidate && !mineStorageValue) {
        const prompted =
          typeof window !== "undefined"
            ? window.prompt(
                "Enter your submitter_id to filter feedback to items you sent. This is stored locally only.",
              )
            : null;
        if (prompted && prompted.trim().length > 0) {
          const value = prompted.trim();
          writeMineStorage(value);
          setMineStorageValue(value);
        } else {
          setMineOnly(false);
        }
      }
    },
    [identity?.submitterCandidate, mineStorageValue],
  );

  const clearStoredMineId = useCallback(() => {
    writeMineStorage(null);
    setMineStorageValue(null);
    if (!identity?.submitterCandidate) setMineOnly(false);
  }, [identity?.submitterCandidate]);

  return (
    <PageShell
      title="Feedback"
      titleIcon={<MessageSquare className="h-5 w-5" aria-hidden />}
      description={description}
      actions={showBackgroundQueryRefresh(query) ? <QueryRefreshIndicator /> : undefined}
    >
      <div className="space-y-6">
        <FeedbackStoreSyncPanel
          adminProxyConfigured={adminProxyConfigured}
          adminMode={adminMode}
          baseUrlEnv={adminPreflight.data?.base_url_env ?? "AGENT_SITE_BASE_URL"}
          bearerEnv={adminPreflight.data?.bearer_env ?? "AGENT_SITE_ADMIN_BEARER"}
          modeEnv={adminPreflight.data?.mode_env}
        />

        {adminProxyConfigured ? (
          <Tabs
            value={topTab}
            onValueChange={(v) => setTopTab(v as "all" | "mirrored" | "pending")}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="mirrored">Mirrored records</TabsTrigger>
              <TabsTrigger value="pending">Pending queue</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}

        {!canPublish && adminPreflight.data ? (
          <p className="rounded-md border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">
            {adminProxyConfigured
              ? `Publish-to-pipeline disabled — /session tier is "${
                  identity?.tier ?? "anonymous"
                }" and no active admin cookie. Use AAuth (hardware / software / operator_attested) on API traffic, or run \`neotoma inspector admin unlock\` and open the printed \`/feedback/admin-unlock?challenge=…\` URL (legacy: \`?feedback_unlock_challenge=\` on Feedback). See docs/subsystems/agent_feedback_pipeline.md.`
              : adminMode === "disabled"
              ? `Publish-to-pipeline disabled — admin surface explicitly disabled via ${adminPreflight.data.mode_env ?? "NEOTOMA_FEEDBACK_ADMIN_MODE"}=disabled. Unset it to run the self-contained local pipeline, or set ${adminPreflight.data.base_url_env} and ${adminPreflight.data.bearer_env} to forward to agent.neotoma.io.`
              : `Publish-to-pipeline disabled — set ${adminPreflight.data.base_url_env} and ${adminPreflight.data.bearer_env} on the Neotoma server to enable.`}
          </p>
        ) : null}

        {adminMode === "local" && canPublish ? (
          <p className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-800 dark:text-amber-200">
            Self-contained local mode — status writes stay on this machine and
            mirror into the <code>neotoma_feedback</code> entity graph. Set{" "}
            <code>{adminPreflight.data?.base_url_env ?? "AGENT_SITE_BASE_URL"}</code>{" "}
            +{" "}
            <code>{adminPreflight.data?.bearer_env ?? "AGENT_SITE_ADMIN_BEARER"}</code>{" "}
            on the Neotoma server to forward to agent.neotoma.io.
          </p>
        ) : null}

        {adminProxyConfigured && topTab === "pending" ? (
          <div className="space-y-4">
            <FindByCommitPanel />
            <PendingQueue />
          </div>
        ) : adminProxyConfigured && topTab === "all" ? (
          <LocalStoreList />
        ) : (
          <FeedbackListContent
            summary={summary}
            bucketCounts={bucketCounts}
            bucket={bucket}
            onBucketChange={(v) => {
              setBucket(v);
              setOffset(0);
            }}
            kindFilter={kindFilter}
            onKindFilterChange={(v) => {
              setKindFilter(v);
              setOffset(0);
            }}
            kindOptions={kindOptions}
            submitterFilter={submitterFilter}
            onSubmitterFilterChange={(v) => {
              setSubmitterFilter(v);
              setOffset(0);
            }}
            submitterOptions={submitterOptions}
            sort={sort}
            onSortChange={setSort}
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setOffset(0);
            }}
            mineOnly={mineOnly}
            onMineToggle={handleMineToggle}
            effectiveMineId={effectiveMineId}
            mineStorageValue={mineStorageValue}
            onClearStoredMineId={clearStoredMineId}
            hasSessionIdentity={!!identity?.submitterCandidate}
            hasScratchOnly={hasScratchOnly}
            onHasScratchToggle={(v) => {
              setHasScratchOnly(v);
              setOffset(0);
            }}
            query={query}
            entities={entities}
            filtered={filtered}
            total={total}
            offset={offset}
            onOffsetChange={setOffset}
            submitterActive={submitterForFilter !== null}
            now={now}
            canPromote={canPublish}
            onPromote={handlePromote}
          />
        )}

        {publishState ? (
          <PublishDialog
            open
            onClose={() => setPublishState(null)}
            entity={publishState.entity}
            feedbackId={publishState.feedbackId}
            initialDraft={publishState.draft}
          />
        ) : null}
      </div>
    </PageShell>
  );
}

interface FeedbackListContentProps {
  summary: SummaryStats;
  bucketCounts: Record<StatusBucket, number>;
  bucket: StatusBucket;
  onBucketChange: (v: StatusBucket) => void;
  kindFilter: string;
  onKindFilterChange: (v: string) => void;
  kindOptions: [string, string][];
  submitterFilter: string;
  onSubmitterFilterChange: (v: string) => void;
  submitterOptions: string[];
  sort: FeedbackSort;
  onSortChange: (v: FeedbackSort) => void;
  search: string;
  onSearchChange: (v: string) => void;
  mineOnly: boolean;
  onMineToggle: (v: boolean) => void;
  effectiveMineId: string | null;
  mineStorageValue: string | null;
  onClearStoredMineId: () => void;
  hasSessionIdentity: boolean;
  hasScratchOnly: boolean;
  onHasScratchToggle: (v: boolean) => void;
  query: ReturnType<typeof useNeotomaFeedback>;
  entities: EntitySnapshot[];
  filtered: EntitySnapshot[];
  total: number;
  offset: number;
  onOffsetChange: (next: number) => void;
  submitterActive: boolean;
  now: number;
  canPromote: boolean;
  onPromote: (entity: EntitySnapshot, feedbackId: string, draft: PublishDraft) => void;
}

function FeedbackListContent(props: FeedbackListContentProps) {
  const {
    summary,
    bucketCounts,
    bucket,
    onBucketChange,
    kindFilter,
    onKindFilterChange,
    kindOptions,
    submitterFilter,
    onSubmitterFilterChange,
    submitterOptions,
    sort,
    onSortChange,
    search,
    onSearchChange,
    mineOnly,
    onMineToggle,
    effectiveMineId,
    mineStorageValue,
    onClearStoredMineId,
    hasSessionIdentity,
    hasScratchOnly,
    onHasScratchToggle,
    query,
    entities,
    filtered,
    total,
    offset,
    onOffsetChange,
    submitterActive,
    now,
    canPromote,
    onPromote,
  } = props;

  return (
    <>
      <SummaryStrip summary={summary} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          value={bucket}
          onValueChange={(v) => onBucketChange(v as StatusBucket)}
          className="min-w-0 flex-1"
        >
          <TabsList className="h-auto min-h-10 w-full flex-wrap justify-start gap-1">
            {STATUS_BUCKETS.map((tab) => {
              const count = bucketCounts[tab.value];
              return (
                <Tooltip key={tab.value}>
                  <TooltipTrigger asChild>
                    <TabsTrigger value={tab.value} className="gap-1.5">
                      <span>{tab.label}</span>
                      <Badge
                        variant="secondary"
                        className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px] font-medium tabular-nums"
                      >
                        {count}
                      </Badge>
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {tab.help}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:w-auto">
          <div className="grid min-w-[11rem] gap-1.5">
            <Label htmlFor="feedback-kind" className="text-xs text-muted-foreground">
              Kind
            </Label>
            <Select value={kindFilter} onValueChange={onKindFilterChange}>
              <SelectTrigger id="feedback-kind" className="h-9">
                <SelectValue placeholder="All kinds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                {kindOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-[11rem] gap-1.5">
            <Label htmlFor="feedback-submitter" className="text-xs text-muted-foreground">
              Submitter
            </Label>
            <Select
              value={submitterFilter}
              onValueChange={onSubmitterFilterChange}
              disabled={mineOnly}
            >
              <SelectTrigger id="feedback-submitter" className="h-9">
                <SelectValue placeholder="All submitters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All submitters</SelectItem>
                {submitterOptions.map((id) => (
                  <SelectItem key={id} value={id}>
                    {shortId(id, 18)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-[11rem] gap-1.5">
            <Label htmlFor="feedback-sort" className="text-xs text-muted-foreground">
              Sort
            </Label>
            <Select value={sort} onValueChange={(v) => onSortChange(v as FeedbackSort)}>
              <SelectTrigger id="feedback-sort" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_LABELS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-[14rem] gap-1.5">
            <Label htmlFor="feedback-search" className="text-xs text-muted-foreground">
              Search
            </Label>
            <Input
              id="feedback-search"
              placeholder="Title, error message, tool…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="inline-flex items-center gap-2">
          <Checkbox
            checked={mineOnly}
            onCheckedChange={(v) => onMineToggle(v === true)}
          />
          <span>
            Mine only
            {effectiveMineId ? (
              <span className="ml-1 font-mono">({shortId(effectiveMineId, 10)})</span>
            ) : null}
          </span>
        </label>
        {mineOnly && !hasSessionIdentity && mineStorageValue ? (
          <button
            type="button"
            onClick={onClearStoredMineId}
            className="text-xs text-primary hover:underline"
          >
            Clear stored ID
          </button>
        ) : null}
        {mineOnly && !effectiveMineId ? (
          <span className="text-amber-600 dark:text-amber-400">
            No submitter_id available — set one in Mine-only prompt or wait for session auth.
          </span>
        ) : null}
        <label className="inline-flex items-center gap-2">
          <Checkbox
            checked={hasScratchOnly}
            onCheckedChange={(v) => onHasScratchToggle(v === true)}
          />
          <span>Has scratch</span>
        </label>
      </div>

      <Separator />

      {showInitialQuerySkeleton(query) ? (
        <ListSkeleton rows={6} />
      ) : query.error ? (
        <QueryErrorAlert title="Could not load feedback">
          {query.error.message}
        </QueryErrorAlert>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasRecords={entities.length > 0}
          bucket={bucket}
          kindFilter={kindFilter}
          submitterActive={submitterActive}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((entity) => (
            <FeedbackCard
              key={entityRowId(entity)}
              entity={entity}
              now={now}
              canPromote={canPromote}
              onPromote={onPromote}
            />
          ))}
        </div>
      )}

      {(offset > 0 || total > offset + entities.length) && (
        <Pagination className="mx-0 w-full justify-between">
          <PaginationContent className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {entities.length === 0
                ? "No records on this page."
                : `Showing ${offset + 1}–${offset + entities.length} of ${total.toLocaleString()}`}
            </p>
            <div className="flex items-center gap-1">
              <PaginationItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <PaginationPrevious
                        size="icon"
                        disabled={offset === 0}
                        onClick={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Newer feedback</TooltipContent>
                </Tooltip>
              </PaginationItem>
              <PaginationItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <PaginationNext
                        size="icon"
                        disabled={offset + entities.length >= total}
                        onClick={() => onOffsetChange(offset + PAGE_SIZE)}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Older feedback</TooltipContent>
                </Tooltip>
              </PaginationItem>
            </div>
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
}

function SummaryStrip({ summary }: { summary: SummaryStats }) {
  const tiles: { label: string; value: number; icon: React.ReactNode; tint: string }[] = [
    {
      label: "Total",
      value: summary.total,
      icon: <MessageSquare className="h-4 w-4" aria-hidden />,
      tint: "bg-muted text-foreground",
    },
    {
      label: "Open",
      value: summary.open,
      icon: <CircleDot className="h-4 w-4" aria-hidden />,
      tint: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      label: "Stale",
      value: summary.stale,
      icon: <Hourglass className="h-4 w-4" aria-hidden />,
      tint: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    },
    {
      label: "In progress",
      value: summary.inProgress,
      icon: <RefreshCw className="h-4 w-4" aria-hidden />,
      tint: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
    {
      label: "Resolved",
      value: summary.resolved,
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
      tint: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Regressions",
      value: summary.regression,
      icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
      tint: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm"
        >
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {tile.label}
            </div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">
              {tile.value.toLocaleString()}
            </div>
          </div>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", tile.tint)}>
            {tile.icon}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasRecords,
  bucket,
  kindFilter,
  submitterActive,
}: {
  hasRecords: boolean;
  bucket: StatusBucket;
  kindFilter: string;
  submitterActive: boolean;
}) {
  if (!hasRecords) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        No <code className="rounded bg-muted px-1 py-0.5 text-xs">neotoma_feedback</code>{" "}
        entities yet. Records appear here once an agent submits via{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">submit_feedback</code>{" "}
        or the agent.neotoma.io pipeline forwards a mirrored item.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      No feedback matches the current filters
      {bucket !== "all" ? ` in the "${STATUS_BUCKETS.find((b) => b.value === bucket)?.label}" bucket` : ""}
      {kindFilter !== "all" ? ` for kind "${KIND_LABELS[kindFilter] ?? kindFilter}"` : ""}
      {submitterActive ? " with the selected submitter" : ""}.
    </div>
  );
}

function FeedbackCard({
  entity,
  now,
  canPromote,
  onPromote,
}: {
  entity: EntitySnapshot;
  now: number;
  canPromote: boolean;
  onPromote?: (entity: EntitySnapshot, feedbackId: string, draft: PublishDraft) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const snap = snapshotOf(entity);
  const id = entityRowId(entity);
  const title = feedbackTitle(entity, snap);
  const hasScratch = hasScratchAnnotations(entity);
  const activityAt = activityTimestamp(snap, entity.last_observation_at);
  const submitterBits = submitterLabel(snap);
  const stale = isStale(entity, snap, now);

  const issueUrls = arrayOfStrings(snap.github_issue_urls);
  const prUrls = arrayOfStrings(snap.pull_request_urls);
  const commitShas = arrayOfStrings(snap.commit_shas);
  const verifications = Array.isArray(snap.verifications) ? snap.verifications.length : 0;
  const verificationCounts = snap.verification_count_by_outcome ?? {};
  const verifiedFixes = typeof verificationCounts.verified === "number" ? verificationCounts.verified : 0;

  const hasResolutionLinks = issueUrls.length + prUrls.length + commitShas.length > 0;
  const upgradeGuidance = parseUpgradeGuidance(snap.upgrade_guidance);
  const nextCheckLabel = formatNextCheckCountdown(snap.next_check_suggested_at, now);

  const heroErrorLine =
    snap.error_class || snap.error_type || snap.tool_name
      ? [snap.error_class ?? snap.error_type, snap.tool_name].filter(Boolean).join(" · ")
      : null;

  const handleScratchPromote = onPromote
    ? (draft: PublishDraft) => {
        if (!snap.feedback_id) return;
        onPromote(entity, snap.feedback_id, draft);
      }
    : undefined;

  return (
    <details
      className="rounded-lg border bg-card shadow-sm open:ring-1 open:ring-border"
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex min-w-0 items-start gap-2">
              <EntityLink
                id={id}
                name={title}
                className="inline-block max-w-full truncate text-base font-semibold text-foreground hover:underline"
                title={snap.feedback_id ? `feedback_id: ${snap.feedback_id}` : id}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={snap.status} />
              <KindBadge kind={snap.kind} />
              {snap.classification ? (
                <Badge variant="outline" className="font-normal">
                  {snap.classification}
                </Badge>
              ) : null}
              {stale ? (
                <Badge
                  variant="outline"
                  className="border-orange-500/50 font-normal text-orange-700 dark:text-orange-300"
                >
                  <Hourglass className="mr-1 h-3 w-3" aria-hidden /> Stale
                </Badge>
              ) : null}
              {snap.regression_candidate ? (
                <Badge
                  variant="outline"
                  className="border-rose-500/50 font-normal text-rose-700 dark:text-rose-300"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden /> Regression
                </Badge>
              ) : null}
              {snap.duplicate_of_feedback_id ? (
                <Badge variant="secondary" className="font-normal">
                  Duplicate of {shortId(snap.duplicate_of_feedback_id, 8)}
                </Badge>
              ) : null}
              {hasScratch ? (
                <Badge
                  variant="outline"
                  className="border-amber-400/70 font-normal text-amber-700 dark:text-amber-300"
                >
                  Scratch
                </Badge>
              ) : null}
              {activityAt ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      <LiveRelativeTime iso={activityAt} title={false} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{absoluteDateTime(activityAt)}</TooltipContent>
                </Tooltip>
              ) : null}
              {nextCheckLabel ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="font-normal">
                      Poll in {nextCheckLabel}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {snap.next_check_suggested_at
                      ? `Next check: ${absoluteDateTime(snap.next_check_suggested_at)}`
                      : "Next check suggested"}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {submitterBits ? <span className="truncate">{submitterBits}</span> : null}
            </div>
            {heroErrorLine ? (
              <p className="truncate text-sm font-mono text-muted-foreground">{heroErrorLine}</p>
            ) : null}
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
              {verifications > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  {verifications} verification{verifications === 1 ? "" : "s"}
                  {verifiedFixes > 0 ? ` · ${verifiedFixes} verified` : ""}
                </span>
              ) : null}
              {typeof snap.hit_count === "number" && snap.hit_count > 1 ? (
                <span className="inline-flex items-center gap-1">
                  <CircleDot className="h-3.5 w-3.5" aria-hidden />
                  hit {snap.hit_count}×
                </span>
              ) : null}
            </div>
          </div>
          <EntityOpenIconLink id={id} title={snap.feedback_id ?? id} />
        </div>
      </summary>

      <div className="space-y-4 border-t px-4 py-4">
        {snap.body ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Body
            </h3>
            <p className="mt-2 whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-sm">
              {snap.body}
            </p>
          </section>
        ) : null}

        {snap.error_message ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Error message
            </h3>
            <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-3 text-xs font-mono">
              {snap.error_message}
            </pre>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          <KeyValueBlock
            title="Submitter"
            rows={[
              ["Submitter", snap.submitter_id ? shortId(snap.submitter_id, 12) : null],
              ["Client", snap.client_name],
              ["Client version", snap.client_version],
              ["Neotoma version", snap.neotoma_version],
              ["OS", snap.os],
              ["Tool", snap.tool_name],
            ]}
          />
          <KeyValueBlock
            title="Pipeline"
            rows={[
              ["feedback_id", snap.feedback_id ? shortId(snap.feedback_id, 18) : null],
              ["Submitted", snap.submitted_at ? absoluteDateTime(snap.submitted_at) : null],
              ["Status updated", snap.status_updated_at ? absoluteDateTime(snap.status_updated_at) : null],
              ["Last activity", snap.last_activity_at ? absoluteDateTime(snap.last_activity_at) : null],
              [
                "Next check",
                snap.next_check_suggested_at ? absoluteDateTime(snap.next_check_suggested_at) : null,
              ],
              ["Resolution confidence", snap.resolution_confidence],
              ["Superseded by", snap.superseded_by_version],
            ]}
          />
        </section>

        {hasResolutionLinks ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resolution links
            </h3>
            <ul className="mt-2 space-y-1.5">
              {issueUrls.map((url) => (
                <LinkRow key={`issue:${url}`} url={url} icon={<FileText className="h-3.5 w-3.5" />} />
              ))}
              {prUrls.map((url) => (
                <LinkRow key={`pr:${url}`} url={url} icon={<GitPullRequest className="h-3.5 w-3.5" />} />
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

        {snap.triage_notes || snap.notes_markdown ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Triage notes
            </h3>
            <div className="mt-2 whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-sm">
              {snap.triage_notes ?? snap.notes_markdown}
            </div>
          </section>
        ) : null}

        {upgradeGuidance ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Upgrade guidance
            </h3>
            <UpgradeGuidanceBlock guidance={upgradeGuidance} />
          </section>
        ) : null}

        {snap.regression_candidate ? (
          <section className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Regression candidate
            </div>
            <p className="mt-1 text-muted-foreground">
              {snap.regression_detected_at ? (
                <>
                  Detected <LiveRelativeTime iso={snap.regression_detected_at} title={false} />
                </>
              ) : (
                "No detection timestamp"
              )}
              {typeof snap.regression_count === "number" && snap.regression_count > 0
                ? ` · ${snap.regression_count} hit${snap.regression_count === 1 ? "" : "s"}`
                : ""}
            </p>
          </section>
        ) : null}

        <ScratchBlock
          entity={entity}
          canPromote={canPromote && !!snap.feedback_id}
          onPromote={handleScratchPromote}
        />

        {canPromote && snap.feedback_id ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                onPromote?.(entity, snap.feedback_id!, {
                  status: snap.status,
                  triage_notes: snap.triage_notes ?? snap.notes_markdown,
                  issue_urls: issueUrls,
                  pr_urls: prUrls,
                  duplicate_of_feedback_id: snap.duplicate_of_feedback_id,
                })
              }
            >
              Publish to pipeline…
            </button>
          </div>
        ) : null}

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Observation history
          </h3>
          <div className="mt-2">
            {expanded ? (
              <FeedbackTimeline entityId={id} />
            ) : (
              <p className="text-sm text-muted-foreground">Expand to load timeline.</p>
            )}
          </div>
        </section>
      </div>
    </details>
  );
}

function KeyValueBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string | null | undefined][];
}) {
  const visible = rows.filter(([, v]) => v != null && String(v).trim() !== "");
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

function LinkRow({ url, icon }: { url: string; icon: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-primary hover:underline"
      >
        {url}
      </a>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${url}`}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </li>
  );
}

function UpgradeGuidanceBlock({
  guidance,
}: {
  guidance: ReturnType<typeof parseUpgradeGuidance>;
}) {
  if (!guidance) return null;
  return (
    <div className="mt-2 space-y-3 rounded bg-muted/40 p-3 text-sm">
      {guidance.actionRequired ? (
        <p>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Action:
          </span>{" "}
          {guidance.actionRequired}
        </p>
      ) : null}
      {guidance.installCommands.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Install commands
          </p>
          <ul className="mt-1 space-y-1">
            {guidance.installCommands.map((cmd) => (
              <li key={cmd}>
                <code className="block overflow-x-auto rounded bg-background px-2 py-1 font-mono text-xs">
                  {cmd}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {guidance.verificationSteps.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Verification
          </p>
          <ol className="mt-1 list-inside list-decimal space-y-1 text-sm">
            {guidance.verificationSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guidance.verifyBy ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Verify by {absoluteDateTime(guidance.verifyBy)}
            </p>
          ) : null}
        </div>
      ) : null}
      {guidance.notes ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{guidance.notes}</p>
      ) : null}
    </div>
  );
}
