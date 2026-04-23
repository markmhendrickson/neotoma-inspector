import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useEntitiesQuery } from "@/hooks/use_entities";
import { useStats } from "@/hooks/use_stats";
import { PageShell } from "@/components/layout/page_shell";
import { DataTableSkeleton, QueryErrorAlert } from "@/components/shared/query_status";
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
  const initialSearch = searchParams.get("search") || "";
  const [search, setSearch] = useState(initialSearch);
  const [entityType, setEntityType] = useState(initialType);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("last_observation_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [identityBasis, setIdentityBasis] = useState<string>("");

  const stats = useStats();
  const entityTypes = stats.data ? Object.keys(stats.data.entities_by_type).sort() : [];
  const [typeSelectQuery, setTypeSelectQuery] = useState("");

  const filteredEntityTypes = useMemo(() => {
    const q = typeSelectQuery.trim().toLowerCase();
    const list = !q ? entityTypes : entityTypes.filter((t) => t.toLowerCase().includes(q));
    if (entityType && entityTypes.includes(entityType) && !list.includes(entityType)) {
      return [entityType, ...list];
    }
    return list;
  }, [entityTypes, typeSelectQuery, entityType]);

  useEffect(() => {
    setSearch(initialSearch);
    setOffset(0);
  }, [initialSearch]);

  useEffect(() => {
    setEntityType(initialType);
    setOffset(0);
  }, [initialType]);

  const query = useEntitiesQuery({
    search: search || undefined,
    entity_type: entityType || undefined,
    limit: PAGE_SIZE,
    offset,
    sort_by: search ? undefined : sortBy,
    sort_order: search ? undefined : sortOrder,
    include_snapshots: true,
    identity_basis:
      (identityBasis as
        | "schema_rule"
        | "schema_lookup"
        | "heuristic_name"
        | "heuristic_fallback"
        | "target_id") || undefined,
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
        <Select
          value={entityType || "__all__"}
          onValueChange={(v) => {
            setEntityType(v === "__all__" ? "" : v);
            setOffset(0);
          }}
          onOpenChange={(open) => {
            if (!open) setTypeSelectQuery("");
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent className="max-h-80 min-w-[var(--radix-select-trigger-width)] sm:min-w-[16rem]">
            <div
              className="sticky top-0 z-10 border-b bg-popover p-2"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Input
                placeholder="Search types…"
                value={typeSelectQuery}
                onChange={(e) => setTypeSelectQuery(e.target.value)}
                className="h-8"
                autoComplete="off"
              />
            </div>
            <SelectItem value="__all__">All types</SelectItem>
            {filteredEntityTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
            {filteredEntityTypes.length === 0 && typeSelectQuery.trim() !== "" ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">No matching types</div>
            ) : null}
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
        <Select
          value={identityBasis || "__any__"}
          onValueChange={(v) => {
            setIdentityBasis(v === "__any__" ? "" : v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[200px]" title="Filter by identity_basis">
            <SelectValue placeholder="Any identity basis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any__">Any identity basis</SelectItem>
            <SelectItem value="schema_rule">schema_rule</SelectItem>
            <SelectItem value="schema_lookup">schema_lookup</SelectItem>
            <SelectItem value="heuristic_name">heuristic_name (ambiguous)</SelectItem>
            <SelectItem value="heuristic_fallback">heuristic_fallback</SelectItem>
            <SelectItem value="target_id">target_id</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <DataTableSkeleton rows={12} cols={5} />
      ) : query.error ? (
        <QueryErrorAlert title="Could not load entities">{query.error.message}</QueryErrorAlert>
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
