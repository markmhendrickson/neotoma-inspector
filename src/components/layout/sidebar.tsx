import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isApiUrlConfigured } from "@/api/client";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { queryEntities } from "@/api/endpoints/entities";
import { listSources } from "@/api/endpoints/sources";
import { TypeBadge } from "@/components/shared/type_badge";
import { sourceKindLabel, sourceTitle } from "@/lib/source_display";
import { cn, truncateId } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard,
  Box,
  Eye,
  FileText,
  GitBranch,
  Network,
  Database,
  Clock,
  Activity,
  Repeat,
  MessageSquare,
  MessageSquareText,
  Cpu,
  ShieldCheck,
  KeyRound,
  Settings,
  Loader2,
  Search,
} from "lucide-react";
import type { EntitySnapshot } from "@/types/api";
import neotomaMarkUrl from "@/assets/neotoma_mark.svg?url";

const ENTITY_SUGGESTION_LIMIT = 4;
const SOURCE_SUGGESTION_LIMIT = 4;

const navGroups = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/conversations", label: "Conversations", icon: MessageSquareText },
      { to: "/turns", label: "Turns", icon: Repeat },
      { to: "/compliance", label: "Compliance", icon: ShieldCheck },
      { to: "/activity", label: "Activity", icon: Activity },
      { to: "/feedback", label: "Feedback", icon: MessageSquare },
    ],
  },
  {
    items: [
      { to: "/entities", label: "Entities", icon: Box },
      { to: "/observations", label: "Observations", icon: Eye },
      { to: "/sources", label: "Sources", icon: FileText },
      { to: "/relationships", label: "Relationships", icon: GitBranch },
      { to: "/graph", label: "Graph Explorer", icon: Network },
    ],
  },
  {
    items: [
      { to: "/schemas", label: "Schemas", icon: Database },
      { to: "/timeline", label: "Timeline", icon: Clock },
      { to: "/interpretations", label: "Interpretations", icon: Cpu },
      { to: "/agents", label: "Agents", icon: ShieldCheck },
      { to: "/agents/grants", label: "Agent grants", icon: KeyRound },
    ],
  },
  {
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(location.pathname.startsWith("/search") ? params.get("search") ?? "" : "");
  }, [location.pathname, location.search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [search]);

  // Longest-prefix match across all nav items so nested entries (e.g.
  // `/agents/grants` under `/agents`) don't double-highlight their parent.
  const allNavTargets = navGroups.flatMap((g) => g.items.map((i) => i.to));
  function isActive(to: string) {
    if (to === "/") return location.pathname === "/";
    if (!location.pathname.startsWith(to)) return false;
    const longerMatch = allNavTargets.find(
      (other) =>
        other !== to &&
        other.startsWith(to) &&
        location.pathname.startsWith(other),
    );
    return !longerMatch;
  }

  function navigateToSearchResults(query: string) {
    const params = new URLSearchParams();
    if (query) {
      params.set("search", query);
    }
    navigate({
      pathname: "/search",
      search: params.toString() ? `?${params.toString()}` : "",
    });
    setIsFocused(false);
  }

  function handleSearchContainerBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextFocused = event.relatedTarget;
    if (nextFocused instanceof Node && searchContainerRef.current?.contains(nextFocused)) {
      return;
    }
    setIsFocused(false);
  }

  function entityId(entity: EntitySnapshot): string {
    return entity.entity_id ?? entity.id ?? "";
  }

  function entityLabel(entity: EntitySnapshot): string {
    const snapshotName =
      typeof entity.snapshot?.name === "string"
        ? entity.snapshot.name
        : typeof entity.snapshot?.title === "string"
          ? entity.snapshot.title
          : null;
    return entity.canonical_name || snapshotName || truncateId(entityId(entity), 16);
  }

  const suggestionsQuery = useQuery({
    queryKey: ["sidebar-search", debouncedSearch],
    queryFn: async () => {
      const [entities, sources] = await Promise.all([
        queryEntities({
          search: debouncedSearch,
          limit: ENTITY_SUGGESTION_LIMIT,
          include_snapshots: true,
        }),
        listSources({
          search: debouncedSearch,
          limit: SOURCE_SUGGESTION_LIMIT,
        }),
      ]);
      return {
        entities: entities.entities,
        sources: sources.sources,
      };
    },
    enabled: isApiUrlConfigured() && debouncedSearch.length > 0,
  });

  const trimmedSearch = search.trim();
  const isDebouncingKeyword = trimmedSearch !== debouncedSearch;
  const entitySuggestions = suggestionsQuery.data?.entities ?? [];
  const sourceSuggestions = suggestionsQuery.data?.sources ?? [];
  const hasSuggestions = entitySuggestions.length > 0 || sourceSuggestions.length > 0;
  const showSuggestions = isFocused && trimmedSearch.length > 0;
  const isResolvingSuggestions =
    trimmedSearch.length > 0 &&
    (isDebouncingKeyword || suggestionsQuery.isPending || suggestionsQuery.isFetching);

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <img
            src={neotomaMarkUrl}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0"
          />
          <span>Neotoma</span>
        </Link>
      </div>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <nav className="flex flex-col gap-1 p-3">
          <div
            ref={searchContainerRef}
            className="relative mb-2"
            onBlurCapture={handleSearchContainerBlur}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/50" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  navigateToSearchResults(trimmedSearch);
                }
                if (event.key === "Escape") {
                  setIsFocused(false);
                }
              }}
              placeholder="Search entities and sources"
              className="border-sidebar-border bg-sidebar pl-9 text-sidebar-foreground placeholder:text-sidebar-foreground/50"
              aria-label="Search entities and sources"
            />
            {showSuggestions ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                  {isResolvingSuggestions ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      Searching…
                    </div>
                  ) : hasSuggestions ? (
                    <>
                      <div className="max-h-80 overflow-y-auto p-1">
                        {entitySuggestions.length > 0 ? (
                          <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Entities
                          </div>
                        ) : null}
                        {entitySuggestions.map((entity) => (
                          <Link
                            key={entityId(entity)}
                            to={`/entities/${encodeURIComponent(entityId(entity))}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setIsFocused(false)}
                            className="block rounded-sm px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                          >
                            <div className="truncate text-sm font-medium">{entityLabel(entity)}</div>
                            <div className="mt-1 flex items-center gap-2">
                              <TypeBadge type={entity.entity_type} humanize className="max-w-[9rem] truncate" />
                              <span className="truncate font-mono text-[11px] text-muted-foreground">
                                {truncateId(entityId(entity), 12)}
                              </span>
                            </div>
                          </Link>
                        ))}
                        {sourceSuggestions.length > 0 ? (
                          <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Sources
                          </div>
                        ) : null}
                        {sourceSuggestions.map((source) => (
                          <Link
                            key={source.id}
                            to={`/sources/${encodeURIComponent(source.id)}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setIsFocused(false)}
                            className="block rounded-sm px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                          >
                            <div className="truncate text-sm font-medium">{sourceTitle(source)}</div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{sourceKindLabel(source)}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                      <div className="border-t p-1">
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => navigateToSearchResults(trimmedSearch)}
                          className="w-full rounded-sm px-3 py-2 text-left text-sm text-primary hover:bg-accent hover:text-accent-foreground"
                        >
                          View all matches
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No matching entities or sources
                    </div>
                  )}
                </div>
              ) : null}
          </div>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <Separator className="my-2" />}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
