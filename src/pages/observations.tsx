import { useState } from "react";
import { useObservationsQuery } from "@/hooks/use_observations";
import { useCreateObservation } from "@/hooks/use_mutations";
import { PageShell } from "@/components/layout/page_shell";
import { DataTable } from "@/components/shared/data_table";
import { EntityLink } from "@/components/shared/entity_link";
import { SourceLink } from "@/components/shared/source_link";
import { TypeBadge } from "@/components/shared/type_badge";
import { JsonViewer } from "@/components/shared/json_viewer";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Observation } from "@/types/api";

const PAGE_SIZE = 25;

export default function ObservationsPage() {
  const [entityId, setEntityId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [offset, setOffset] = useState(0);

  const [createEntityId, setCreateEntityId] = useState("");
  const [createEntityType, setCreateEntityType] = useState("");
  const [createFields, setCreateFields] = useState("{}");
  const createMut = useCreateObservation();

  const query = useObservationsQuery({
    entity_id: entityId || undefined,
    entity_type: entityType || undefined,
    source_id: sourceId || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const [expanded, setExpanded] = useState<string | null>(null);

  const columns: ColumnDef<Observation, unknown>[] = [
    {
      header: "Entity",
      accessorKey: "entity_id",
      cell: ({ row }) => (
        <div>
          <EntityLink id={row.original.entity_id} />
          <div className="mt-0.5"><TypeBadge type={row.original.entity_type} /></div>
        </div>
      ),
    },
    {
      header: "Source",
      accessorKey: "source_id",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <SourceLink id={v} /> : <span className="text-muted-foreground">—</span>;
      },
    },
    { header: "Priority", accessorKey: "source_priority" },
    { header: "Specificity", accessorKey: "specificity_score", cell: ({ getValue }) => (getValue() as number)?.toFixed(2) ?? "—" },
    { header: "Observed", accessorKey: "observed_at", cell: ({ getValue }) => formatDate(getValue() as string) },
    {
      header: "Fields",
      id: "field_count",
      cell: ({ row }) => {
        const fields = row.original.fields;
        const count = fields ? Object.keys(fields).length : 0;
        return (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === row.original.id ? null : row.original.id)}>
            {count} fields {expanded === row.original.id ? "▾" : "▸"}
          </Button>
        );
      },
    },
  ];

  return (
    <PageShell
      title="Observations"
      description={query.data ? `${query.data.total.toLocaleString()} total` : undefined}
      actions={
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3 w-3 mr-1" /> Create</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Observation</DialogTitle><DialogDescription>Directly create an observation for an entity.</DialogDescription></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Entity ID</Label><Input value={createEntityId} onChange={(e) => setCreateEntityId(e.target.value)} /></div>
              <div><Label>Entity Type</Label><Input value={createEntityType} onChange={(e) => setCreateEntityType(e.target.value)} /></div>
              <div><Label>Fields (JSON)</Label><Textarea value={createFields} onChange={(e) => setCreateFields(e.target.value)} rows={5} className="font-mono text-xs" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                try {
                  const fields = JSON.parse(createFields);
                  createMut.mutate(
                    { entity_id: createEntityId, entity_type: createEntityType, fields },
                    { onSuccess: () => { toast.success("Observation created"); setCreateEntityId(""); setCreateEntityType(""); setCreateFields("{}"); } }
                  );
                } catch { toast.error("Invalid JSON in fields"); }
              }}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filter by entity ID…" value={entityId} onChange={(e) => { setEntityId(e.target.value); setOffset(0); }} className="pl-9" />
        </div>
        <Input placeholder="Entity type…" value={entityType} onChange={(e) => { setEntityType(e.target.value); setOffset(0); }} className="w-[150px]" />
        <Input placeholder="Source ID…" value={sourceId} onChange={(e) => { setSourceId(e.target.value); setOffset(0); }} className="w-[180px]" />
      </div>

      {query.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : query.error ? (
        <div className="text-destructive">Error: {query.error.message}</div>
      ) : (
        <>
          <DataTable columns={columns} data={query.data?.observations ?? []} />
          {expanded && (
            <div className="rounded-md border p-4 mt-2">
              <JsonViewer data={query.data?.observations?.find((o) => o.id === expanded)?.fields} defaultExpanded />
            </div>
          )}
          {query.data && query.data.total > PAGE_SIZE && (
            <Pagination offset={offset} limit={PAGE_SIZE} total={query.data.total} onPageChange={setOffset} />
          )}
        </>
      )}
    </PageShell>
  );
}
