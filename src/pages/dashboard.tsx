import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { isApiUrlConfigured, MISSING_API_URL_MESSAGE } from "@/api/client";
import { useStats } from "@/hooks/use_stats";
import { useRecentConversations } from "@/hooks/use_recent_conversations";
import { useHealthCheck, useServerInfo, useHealthCheckSnapshots } from "@/hooks/use_infra";
import { PageShell } from "@/components/layout/page_shell";
import { RecentConversationsFeed } from "@/components/shared/recent_conversations_feed";
import { AttributionSummary } from "@/components/shared/attribution_summary";
import { StatCard } from "@/components/shared/stat_card";
import { TypeBadge } from "@/components/shared/type_badge";
import {
  DashboardStatsSkeleton,
  ListSkeleton,
  QueryErrorAlert,
} from "@/components/shared/query_status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { Box, ChevronDown, Eye, FileText, GitBranch, Clock, Cpu, Shield, ListFilter, MessageSquareText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/** Default number of entity types shown in the bar chart (by count, highest first). */
const CHART_DEFAULT_MAX_TYPES = 10;
const BADGE_DEFAULT_MAX_TYPES = 10;
const BADGE_INCREMENT = 10;

export default function DashboardPage() {
  const stats = useStats();
  const recentConversations = useRecentConversations({ limit: 10, offset: 0 });
  const health = useHealthCheck();
  const serverInfo = useServerInfo();
  const snapshotHealth = useHealthCheckSnapshots();

  const s = stats.data;

  const typeEntries = useMemo(() => {
    if (!s) return [];
    return Object.entries(s.entities_by_type).sort(([, a], [, b]) => b - a);
  }, [s]);

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set());
  const [visibleTypeCount, setVisibleTypeCount] = useState(BADGE_DEFAULT_MAX_TYPES);

  useEffect(() => {
    if (!s) return;
    const sorted = Object.entries(s.entities_by_type).sort(([, a], [, b]) => b - a);
    const defaultSelection = new Set(
      sorted.slice(0, CHART_DEFAULT_MAX_TYPES).map(([type]) => type)
    );
    setSelectedTypes((prev) => {
      if (prev.size === 0) return defaultSelection;
      return prev;
    });
  }, [s]);

  const chartData = useMemo(
    () =>
      typeEntries
        .filter(([type]) => selectedTypes.has(type))
        .map(([type, count]) => ({ type, count })),
    [typeEntries, selectedTypes]
  );

  const visibleTypeEntries = useMemo(
    () => typeEntries.slice(0, visibleTypeCount),
    [typeEntries, visibleTypeCount]
  );
  const hasMoreTypeBadges = visibleTypeEntries.length < typeEntries.length;

  function toggleChartType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function selectAllChartTypes() {
    if (!s) return;
    setSelectedTypes(new Set(Object.keys(s.entities_by_type)));
  }

  function clearChartTypes() {
    setSelectedTypes(new Set());
  }

  const selectedCount = selectedTypes.size;
  const chartTypesLabel =
    typeEntries.length === 0
      ? "Types"
      : selectedCount === 0
        ? "None selected"
        : selectedCount === typeEntries.length
          ? "All types"
          : `${selectedCount} of ${typeEntries.length} types`;

  return (
    <PageShell
      title="Dashboard"
      description={
        !isApiUrlConfigured()
          ? "API not configured"
          : s
            ? `Last updated ${formatDate(s.last_updated)}`
            : "Loading…"
      }
    >
      {!isApiUrlConfigured() ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-muted-foreground">{MISSING_API_URL_MESSAGE}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="default" size="sm">
                <a
                  href="/?from=inspector"
                  rel="noopener"
                >
                  Start a sandbox session
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings">Open Settings</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The sandbox provisions an ephemeral workspace with your choice of fixture pack and
              sends you back here via a one-time handoff code — no copy-paste of bearer tokens.
            </p>
          </CardContent>
        </Card>
      ) : stats.isLoading ? (
        <DashboardStatsSkeleton />
      ) : stats.error ? (
        <QueryErrorAlert title="Could not load dashboard stats">{stats.error.message}</QueryErrorAlert>
      ) : s ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard title="Entities" value={s.total_entities} icon={Box} />
            <StatCard title="Observations" value={s.total_observations} icon={Eye} />
            <StatCard title="Sources" value={s.sources_count} icon={FileText} />
            <StatCard title="Relationships" value={s.total_relationships} icon={GitBranch} />
            <StatCard title="Events" value={s.total_events} icon={Clock} />
            <StatCard title="Interpretations" value={s.total_interpretations} icon={Cpu} />
          </div>

          <Separator />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquareText className="h-4 w-4" /> Recent conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentConversations.isLoading ? (
                <ListSkeleton rows={4} />
              ) : recentConversations.error ? (
                <QueryErrorAlert title="Could not load conversations">
                  {recentConversations.error.message}
                </QueryErrorAlert>
              ) : (
                <RecentConversationsFeed
                  conversations={(recentConversations.data?.items ?? []).slice(0, 10)}
                  compact
                  showViewAll
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="text-base">Entities by Type</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                      <ListFilter className="h-3.5 w-3.5" />
                      <span className="max-w-[140px] truncate sm:max-w-[200px]">{chartTypesLabel}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
                    <DropdownMenuLabel>Types in chart</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        selectAllChartTypes();
                      }}
                    >
                      Select all
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        clearChartTypes();
                      }}
                    >
                      Clear all
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {typeEntries.map(([type, count]) => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={selectedTypes.has(type)}
                        onCheckedChange={() => toggleChartType(type)}
                        className="pr-2"
                      >
                        <div className="flex w-full min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate" title={type}>
                            {type}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{count}</span>
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                {typeEntries.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No entities yet.</p>
                ) : selectedCount === 0 ? (
                  <p className="text-muted-foreground text-sm">Select at least one type to show the chart.</p>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="type" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="hsl(240 5.9% 10%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">No data for the current selection.</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {visibleTypeEntries.map(([type, count]) => (
                    <Link key={type} to={`/entities?type=${encodeURIComponent(type)}`}>
                      <TypeBadge type={type} className="cursor-pointer" />
                      <span className="ml-1 text-xs text-muted-foreground">{count}</span>
                    </Link>
                  ))}
                </div>
                {typeEntries.length > BADGE_DEFAULT_MAX_TYPES ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {hasMoreTypeBadges ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVisibleTypeCount((c) => c + BADGE_INCREMENT)}
                        >
                          Show more
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setVisibleTypeCount(typeEntries.length)}>
                          Show all
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setVisibleTypeCount(BADGE_DEFAULT_MAX_TYPES)}>
                        Show less
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Showing {visibleTypeEntries.length} of {typeEntries.length}
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API</span>
                    <span className={health.data?.ok ? "text-green-600" : "text-red-600"}>
                      {health.data?.ok ? "Healthy" : "Unreachable"}
                    </span>
                  </div>
                  {serverInfo.data && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Port</span>
                        <span>{serverInfo.data.httpPort}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">MCP</span>
                        <p className="font-mono text-[11px] leading-snug break-all">{serverInfo.data.mcpUrl || "—"}</p>
                      </div>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => snapshotHealth.mutate(false)}
                    disabled={snapshotHealth.isPending}
                  >
                    Check Snapshot Health
                  </Button>
                  {snapshotHealth.data && (
                    <p className="text-xs text-muted-foreground">
                      Stale snapshots: {snapshotHealth.data.stale_snapshots ?? 0}
                    </p>
                  )}
                </CardContent>
              </Card>

              <AttributionSummary />
            </div>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
