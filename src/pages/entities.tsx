import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useEntitiesQuery } from "@/hooks/use_entities";
import { useStats } from "@/hooks/use_stats";
import { PageShell } from "@/components/layout/page_shell";
import { DataTable } from "@/components/shared/data_table";
import { TypeBadge } from "@/components/shared/type_badge";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate, truncateId } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { EntitySnapshot } from "@/types/api";
import { Search } from "lucide-react";

const PAGE_SIZE = 25;

function entityRowId(row: EntitySnapshot): string {
  return row.entity_id ?? row.id ?? "";
}

export default function EntitiesPage() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") || "";
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState(initialType);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("last_observation_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const stats = useStats();
  const entityTypes = stats.data ? Object.keys(stats.data.entities_by_type).sort() : [];

  const query = useEntitiesQuery({
    search: search || undefined,
    entity_type: entityType || undefined,
    limit: PAGE_SIZE,
    offset,
    sort_by: search ? undefined : sortBy,
    sort_order: search ? undefined : sortOrder,
    include_snapshots: true,
  });

  const columns: ColumnDef<EntitySnapshot, unknown>[] = [
    {
      header: "Name",
      accessorFn: (row) => row.canonical_name || row.snapshot?.name || row.snapshot?.title || entityRowId(row),
      cell: ({ row }) => {
        const eid = entityRowId(row.original);
        return (
          <Link to={`/entities/${encodeURIComponent(eid)}`} className="font-medium text-primary hover:underline">
            {String(
              row.original.canonical_name ||
                row.original.snapshot?.name ||
                row.original.snapshot?.title ||
                truncateId(eid)
            )}
          </Link>
        );
      },
    },
    {
      header: "Type",
      accessorKey: "entity_type",
      cell: ({ getValue }) => <TypeBadge type={getValue() as string} />,
    },
    {
      header: "Observations",
      accessorKey: "observation_count",
      cell: ({ getValue }) => getValue() ?? "—",
    },
    {
      header: "Last Observation",
      accessorKey: "last_observation_at",
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      header: "ID",
      accessorFn: (row) => entityRowId(row),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{truncateId(getValue() as string, 12)}</span>
      ),
    },
  ];

  return (
    <PageShell title="Entities" description={query.data ? `${query.data.total.toLocaleString()} total` : undefined}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search entities…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={entityType} onValueChange={(v) => { setEntityType(v === "__all__" ? "" : v); setOffset(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!search && (
          <>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_observation_at">Last observed</SelectItem>
                <SelectItem value="canonical_name">Name</SelectItem>
                <SelectItem value="observation_count">Observation count</SelectItem>
                <SelectItem value="entity_id">Entity ID</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
              {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
            </Button>
          </>
        )}
      </div>

      {query.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : query.error ? (
        <div className="text-destructive">Error: {query.error.message}</div>
      ) : (
        <>
          <DataTable columns={columns} data={query.data?.entities ?? []} />
          {query.data && query.data.total > PAGE_SIZE && (
            <Pagination offset={offset} limit={PAGE_SIZE} total={query.data.total} onPageChange={setOffset} />
          )}
        </>
      )}
    </PageShell>
  );
}
