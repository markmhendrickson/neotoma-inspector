import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isApiUrlConfigured } from "@/api/client";
import { Link, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Search as SearchIcon } from "lucide-react";
import { queryEntities } from "@/api/endpoints/entities";
import { listSources } from "@/api/endpoints/sources";
import { PageShell } from "@/components/layout/page_shell";
import { DataTable } from "@/components/shared/data_table";
import { DataTableSkeleton, ListSkeleton, QueryErrorAlert } from "@/components/shared/query_status";
import { TypeBadge } from "@/components/shared/type_badge";
import { Input } from "@/components/ui/input";
import { formatDate, truncateId } from "@/lib/utils";
import { sourceDetail, sourceTitle } from "@/lib/source_display";
import type { EntitySnapshot, Source } from "@/types/api";

const SEARCH_DEBOUNCE_MS = 150;
const ENTITY_PAGE_SIZE = 25;
const SOURCE_PAGE_SIZE = 25;

function entityRowId(row: EntitySnapshot): string {
  return row.entity_id ?? row.id ?? "";
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch.trim());

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalized = search.trim();
      setDebouncedSearch(normalized);

      if (normalized === urlSearch) {
        return;
      }

      const next = new URLSearchParams(searchParams);
      if (normalized) {
        next.set("search", normalized);
      } else {
        next.delete("search");
      }
      setSearchParams(next, { replace: true });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [search, searchParams, setSearchParams, urlSearch]);

  const entitiesQuery = useQuery({
    queryKey: ["search-page", "entities", debouncedSearch],
    queryFn: () =>
      queryEntities({
        search: debouncedSearch,
        limit: ENTITY_PAGE_SIZE,
        include_snapshots: true,
      }),
    enabled: isApiUrlConfigured() && debouncedSearch.length > 0,
  });

  const sourcesQuery = useQuery({
    queryKey: ["search-page", "sources", debouncedSearch],
    queryFn: () =>
      listSources({
        search: debouncedSearch,
        limit: SOURCE_PAGE_SIZE,
      }),
    enabled: isApiUrlConfigured() && debouncedSearch.length > 0,
  });

  const entityColumns = useMemo<ColumnDef<EntitySnapshot, unknown>[]>(
    () => [
      {
        header: "Name",
        accessorFn: (row) => row.canonical_name || row.snapshot?.name || row.snapshot?.title || entityRowId(row),
        cell: ({ row }) => {
          const entityId = entityRowId(row.original);
          return (
            <Link
              to={`/entities/${encodeURIComponent(entityId)}`}
              className="font-medium text-primary hover:underline"
            >
              {String(
                row.original.canonical_name ||
                  row.original.snapshot?.name ||
                  row.original.snapshot?.title ||
                  truncateId(entityId)
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
        header: "Last Observation",
        accessorKey: "last_observation_at",
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      {
        header: "ID",
        accessorFn: (row) => entityRowId(row),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {truncateId(getValue() as string, 12)}
          </span>
        ),
      },
    ],
    []
  );

  const entities = entitiesQuery.data?.entities ?? [];
  const sources = sourcesQuery.data?.sources ?? [];
  const entityTotal = entitiesQuery.data?.total ?? 0;
  const isSearching = debouncedSearch.length > 0;
  const resultSummary = isSearching
    ? `${entityTotal.toLocaleString()} entity matches${sources.length ? `, ${sources.length.toLocaleString()} source matches loaded` : ""}`
    : "Search entities and sources from one place.";

  return (
    <PageShell title="Search" description={resultSummary}>
      <div className="max-w-xl">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entities and sources…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            aria-label="Search entities and sources"
          />
        </div>
      </div>

      {!isSearching ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Type a keyword to search across entities and sources.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Entities</h2>
              <p className="text-sm text-muted-foreground">
                {entitiesQuery.data
                  ? `${entityTotal.toLocaleString()} total matches`
                  : "Search matches from entity snapshots and canonical names."}
              </p>
            </div>
            {entitiesQuery.isPending ? (
              <DataTableSkeleton rows={8} cols={4} />
            ) : entitiesQuery.error ? (
              <QueryErrorAlert title="Could not load entity matches">
                {entitiesQuery.error.message}
              </QueryErrorAlert>
            ) : entities.length > 0 ? (
              <DataTable columns={entityColumns} data={entities} />
            ) : (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No matching entities.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Sources</h2>
              <p className="text-sm text-muted-foreground">
                Matching raw files, uploads, and stored source material.
              </p>
            </div>
            {sourcesQuery.isPending ? (
              <ListSkeleton rows={6} />
            ) : sourcesQuery.error ? (
              <QueryErrorAlert title="Could not load source matches">
                {sourcesQuery.error.message}
              </QueryErrorAlert>
            ) : sources.length > 0 ? (
              <div className="space-y-2">
                {sources.map((source) => (
                  <SourceSearchCard key={source.id} source={source} />
                ))}
              </div>
            ) : (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No matching sources.
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}

function SourceSearchCard({ source }: { source: Source }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/sources/${encodeURIComponent(source.id)}`}
            className="block truncate text-sm font-medium text-primary hover:underline"
          >
            {sourceTitle(source)}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{sourceDetail(source)}</p>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {truncateId(source.id, 12)}
        </span>
      </div>
    </div>
  );
}
