import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStats } from "@/hooks/use_stats";
import { useTimeline } from "@/hooks/use_timeline";
import { useHealthCheck, useServerInfo, useHealthCheckSnapshots } from "@/hooks/use_infra";
import { PageShell } from "@/components/layout/page_shell";
import { StatCard } from "@/components/shared/stat_card";
import { TypeBadge } from "@/components/shared/type_badge";
import { EntityLink } from "@/components/shared/entity_link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Box, ChevronDown, Eye, FileText, GitBranch, Clock, Cpu, Activity, Shield, ListFilter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/** Default number of entity types shown in the bar chart (by count, highest first). */
const CHART_DEFAULT_MAX_TYPES = 10;

export default function DashboardPage() {
  const stats = useStats();
  const timeline = useTimeline({ limit: 15, order_by: "created_at" });
  const health = useHealthCheck();
  const serverInfo = useServerInfo();
  const snapshotHealth = useHealthCheckSnapshots();

  const s = stats.data;

  const typeEntries = useMemo(() => {
    if (!s) return [];
    return Object.entries(s.entities_by_type).sort(([, a], [, b]) => b - a);
  }, [s]);

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set());

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
    <PageShell title="Dashboard" description={s ? `Last updated ${formatDate(s.last_updated)}` : "Loading…"}>
      {stats.isLoading ? (
        <div className="text-muted-foreground">Loading stats…</div>
      ) : stats.error ? (
        <div className="text-destructive">Failed to load stats: {stats.error.message}</div>
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
                  {Object.entries(s.entities_by_type)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <Link key={type} to={`/entities?type=${encodeURIComponent(type)}`}>
                        <TypeBadge type={type} className="cursor-pointer" />
                        <span className="ml-1 text-xs text-muted-foreground">{count}</span>
                      </Link>
                    ))}
                </div>
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
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MCP</span>
                        <span className="truncate max-w-[180px]">{serverInfo.data.mcpUrl || "—"}</span>
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {timeline.data?.events?.length ? (
                    <div className="space-y-1">
                      {timeline.data.events.slice(0, 10).map((ev) => {
                        const entityId = ev.entity_id || ev.entity_ids?.[0];
                        const label = humanizeEventType(ev.event_type || "event");
                        const eventDate = shortDate(ev.event_timestamp);
                        return (
                          <div key={ev.id} className="flex items-baseline gap-2 py-1 text-xs">
                            <span className="text-muted-foreground whitespace-nowrap shrink-0 w-12 text-right tabular-nums">
                              {relativeTime(ev.created_at || ev.event_timestamp)}
                            </span>
                            <span className="min-w-0 truncate">
                              <span className="font-medium">{label}</span>
                              {entityId && (
                                <EntityLink id={entityId} className="ml-1" />
                              )}
                              {eventDate && (
                                <span className="text-muted-foreground"> — {eventDate}</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent events.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}

function humanizeEventType(raw: string): string {
  const labels: Record<string, string> = {
    TaskDue: "Task due",
    TaskStart: "Task started",
    TaskCompleted: "Task completed",
    InvoiceIssued: "Invoice issued",
    InvoiceDue: "Invoice due",
    EventStart: "Event started",
    EventEnd: "Event ended",
    TransactionDate: "Transaction",
    IncomeDate: "Income received",
    FlightDeparture: "Flight departure",
    FlightArrival: "Flight arrival",
  };
  if (labels[raw]) return labels[raw];
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/, (c) => c.toUpperCase())
    .replace(/\bDate\b/i, "")
    .replace(/\s{2,}/g, " ")
    .trim() || raw;
}

function shortDate(ts: string | undefined | null): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  } catch {
    return null;
  }
}

function relativeTime(ts: string | undefined | null): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    if (hrs < 24) return `${hrs}h`;
    if (days < 30) return `${days}d`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
