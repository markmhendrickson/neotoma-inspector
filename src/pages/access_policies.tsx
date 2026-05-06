import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/layout/page_shell";
import { DataTableSkeleton, QueryErrorAlert } from "@/components/shared/query_status";
import { showBackgroundQueryRefresh, showInitialQuerySkeleton } from "@/lib/query_loading";
import { QueryRefreshIndicator } from "@/components/shared/query_refresh_indicator";
import { useAccessPolicies } from "@/hooks/use_access_policies";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { TypeBadge } from "@/components/shared/type_badge";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";

interface PolicyRow {
  entity_type: string;
  mode: string;
}

function modeBadgeVariant(mode: string): "default" | "secondary" | "destructive" | "outline" {
  switch (mode) {
    case "closed":
      return "secondary";
    case "open":
      return "destructive";
    default:
      return "default";
  }
}

const columns: ColumnDef<PolicyRow>[] = [
  {
    accessorKey: "entity_type",
    header: "Entity Type",
    cell: ({ row }) => (
      <Link
        to={`/schemas/${encodeURIComponent(row.original.entity_type)}`}
        className="hover:underline"
      >
        <TypeBadge type={row.original.entity_type} />
      </Link>
    ),
  },
  {
    accessorKey: "mode",
    header: "Guest Access Policy",
    cell: ({ row }) => (
      <Badge variant={modeBadgeVariant(row.original.mode)}>
        {row.original.mode}
      </Badge>
    ),
  },
];

export default function AccessPoliciesPage() {
  const [query, setQuery] = useState("");
  const policiesQ = useAccessPolicies();

  const rows: PolicyRow[] = useMemo(() => {
    if (!policiesQ.data?.policies) return [];
    return Object.entries(policiesQ.data.policies)
      .map(([entity_type, mode]) => ({ entity_type, mode }))
      .sort((a, b) => a.entity_type.localeCompare(b.entity_type));
  }, [policiesQ.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.entity_type.toLowerCase().includes(q) ||
        r.mode.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const defaultMode = policiesQ.data?.default_mode ?? "closed";

  if (showInitialQuerySkeleton(policiesQ))
    return (
      <PageShell title="Access Policies">
        <DataTableSkeleton />
      </PageShell>
    );
  if (policiesQ.error)
    return (
      <PageShell title="Access Policies">
        <QueryErrorAlert title="Could not load access policies">
          {policiesQ.error.message}
        </QueryErrorAlert>
      </PageShell>
    );

  return (
    <PageShell
      title="Guest Access Policies"
      description="Controls what AAuth-verified guests (not admitted via agent grants) can do with each entity type."
      actions={showBackgroundQueryRefresh(policiesQ) ? <QueryRefreshIndicator /> : null}
    >
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Default Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Entity types not listed below default to{" "}
            <Badge variant="secondary">{defaultMode}</Badge>. Manage policies
            via the CLI:{" "}
            <code className="text-xs">neotoma access set &lt;type&gt; &lt;mode&gt;</code>
          </p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No entity types have a non-default guest access policy configured.
        </p>
      ) : (
        <>
          <Input
            placeholder="Filter by entity type or mode…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm mb-4"
          />
          <DataTable columns={columns} data={filtered} />
        </>
      )}
    </PageShell>
  );
}
