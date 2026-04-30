/**
 * Agents directory.
 *
 * Lists every distinct writer that has stamped `AgentAttribution`
 * provenance across the write-path tables. Clicking a row opens the
 * agent detail view at `/agents/:key`.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { PageShell } from "@/components/layout/page_shell";
import { DataTableSkeleton, QueryErrorAlert } from "@/components/shared/query_status";
import { DataTable } from "@/components/ui/data-table";
import { AgentBadge } from "@/components/shared/agent_badge";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { showBackgroundQueryRefresh, showInitialQuerySkeleton } from "@/lib/query_loading";
import { formatDate } from "@/lib/utils";
import { QueryRefreshIndicator } from "@/components/shared/query_refresh_indicator";
import { useAgents } from "@/hooks/use_agents";
import type { AgentDirectoryEntry, RecordActivityType } from "@/types/api";

function countLabel(
  counts: AgentDirectoryEntry["record_counts"],
  key: RecordActivityType,
): string {
  return String(counts[key] ?? 0);
}

export default function AgentsPage() {
  const [query, setQuery] = useState("");
  const agentsQ = useAgents();

  const filtered = useMemo(() => {
    const items = agentsQ.data?.agents ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) =>
      [
        a.label,
        a.agent_thumbprint,
        a.agent_sub,
        a.client_name,
        a.client_version,
        a.agent_iss,
        a.agent_key,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [agentsQ.data, query]);

  const columns: ColumnDef<AgentDirectoryEntry, unknown>[] = [
    {
      header: "Agent",
      id: "agent",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="flex items-center gap-2">
            <AgentBadge
              attribution={{
                attribution_tier: a.tier,
                client_name: a.client_name ?? undefined,
                client_version: a.client_version ?? undefined,
                agent_sub: a.agent_sub ?? undefined,
                agent_iss: a.agent_iss ?? undefined,
                agent_algorithm: a.agent_algorithm ?? undefined,
                agent_thumbprint: a.agent_thumbprint ?? undefined,
                agent_public_key: a.agent_public_key ?? undefined,
              }}
            />
            <Link
              to={`/agents/${encodeURIComponent(a.agent_key)}`}
              className="font-medium text-foreground hover:underline"
            >
              {a.label}
            </Link>
          </div>
        );
      },
    },
    {
      header: "Tier",
      accessorKey: "tier",
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge>,
    },
    { header: "Total", accessorKey: "total_records" },
    {
      header: "Obs",
      id: "obs",
      cell: ({ row }) => countLabel(row.original.record_counts, "observation"),
    },
    {
      header: "Sources",
      id: "sources",
      cell: ({ row }) => countLabel(row.original.record_counts, "source"),
    },
    {
      header: "Rels",
      id: "rels",
      cell: ({ row }) => countLabel(row.original.record_counts, "relationship"),
    },
    {
      header: "Interp",
      id: "interp",
      cell: ({ row }) =>
        countLabel(row.original.record_counts, "interpretation"),
    },
    {
      header: "Timeline",
      id: "timeline",
      cell: ({ row }) =>
        countLabel(row.original.record_counts, "timeline_event"),
    },
    {
      header: "First seen",
      accessorKey: "first_seen_at",
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      header: "Last seen",
      accessorKey: "last_seen_at",
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
  ];

  return (
    <PageShell
      title="Agents"
      description="Distinct writers seen across observations, sources, relationships, interpretations, and timeline events. Rows are derived from AAuth / clientInfo provenance stamped on each record."
      actions={showBackgroundQueryRefresh(agentsQ) ? <QueryRefreshIndicator /> : undefined}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search by name, subject, thumbprint…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-[320px]"
        />
        {agentsQ.data && (
          <p className="text-sm text-muted-foreground">
            {agentsQ.data.total} agent{agentsQ.data.total === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {showInitialQuerySkeleton(agentsQ) ? (
        <DataTableSkeleton rows={12} cols={9} />
      ) : agentsQ.error ? (
        <QueryErrorAlert title="Could not load agents">{agentsQ.error.message}</QueryErrorAlert>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </PageShell>
  );
}
