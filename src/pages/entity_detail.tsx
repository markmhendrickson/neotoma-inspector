import { useParams, Link } from "react-router-dom";
import { useEntityById, useEntityObservations, useEntityRelationships, useFieldProvenance } from "@/hooks/use_entities";
import { useGraphNeighborhood } from "@/hooks/use_graph";
import { useDeleteEntity, useRestoreEntity, useMergeEntities, useCorrect } from "@/hooks/use_mutations";
import { PageShell } from "@/components/layout/page_shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm_dialog";
import { TypeBadge } from "@/components/shared/type_badge";
import { EntityLink } from "@/components/shared/entity_link";
import { SourceLink } from "@/components/shared/source_link";
import { JsonViewer } from "@/components/shared/json_viewer";
import { DataTable } from "@/components/shared/data_table";
import { formatDate, truncateId } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, RotateCcw, GitMerge, Pencil } from "lucide-react";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Observation, RelationshipSnapshot } from "@/types/api";

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const entity = useEntityById(id);
  const observations = useEntityObservations(id);
  const relationships = useEntityRelationships(id);
  const graph = useGraphNeighborhood(id ? { node_id: id, include_relationships: true, include_sources: true, include_events: true } : null);

  const deleteMut = useDeleteEntity();
  const restoreMut = useRestoreEntity();
  const mergeMut = useMergeEntities();
  const correctMut = useCorrect();

  const [mergeTarget, setMergeTarget] = useState("");
  const [correctField, setCorrectField] = useState("");
  const [correctValue, setCorrectValue] = useState("");
  const [provenanceField, setProvenanceField] = useState<string | undefined>();
  const provenance = useFieldProvenance(id, provenanceField);

  const e = entity.data;

  const obsColumns: ColumnDef<Observation, unknown>[] = [
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
      accessorKey: "fields",
      cell: ({ getValue }) => {
        const fields = getValue() as Record<string, unknown> | undefined;
        return fields ? <span className="text-xs text-muted-foreground">{Object.keys(fields).length} fields</span> : "—";
      },
    },
  ];

  const relColumns: ColumnDef<RelationshipSnapshot, unknown>[] = [
    { header: "Type", accessorKey: "relationship_type", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    {
      header: "Source Entity",
      accessorKey: "source_entity_id",
      cell: ({ getValue }) => <EntityLink id={getValue() as string} />,
    },
    {
      header: "Target Entity",
      accessorKey: "target_entity_id",
      cell: ({ getValue }) => <EntityLink id={getValue() as string} />,
    },
    { header: "Observations", accessorKey: "observation_count" },
  ];

  if (entity.isLoading) return <PageShell title="Loading…"><div className="text-muted-foreground p-6">Loading entity…</div></PageShell>;
  if (entity.error) return <PageShell title="Error"><div className="text-destructive p-6">{entity.error.message}</div></PageShell>;
  if (!e) return <PageShell title="Not Found"><div className="text-muted-foreground p-6">Entity not found.</div></PageShell>;

  const entityId = e.entity_id ?? e.id ?? id ?? "";
  const displayName = String(
    e.canonical_name || e.snapshot?.name || e.snapshot?.title || (entityId ? truncateId(entityId) : "Entity")
  );

  return (
    <PageShell
      title={displayName}
      description={`${e.entity_type} · ${truncateId(entityId, 16)}`}
      actions={
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Pencil className="h-3 w-3 mr-1" /> Correct</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Correct Field</DialogTitle><DialogDescription>Create a high-priority correction observation.</DialogDescription></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Field</Label><Input value={correctField} onChange={(ev) => setCorrectField(ev.target.value)} placeholder="field_name" /></div>
                <div><Label>Value</Label><Input value={correctValue} onChange={(ev) => setCorrectValue(ev.target.value)} placeholder="new value" /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  if (!correctField) return;
                  correctMut.mutate(
                    {
                      entity_id: entityId,
                      entity_type: e.entity_type,
                      field: correctField,
                      value: correctValue,
                      idempotency_key: `correct-${entityId}-${correctField}-${Date.now()}`,
                    },
                    { onSuccess: () => { toast.success("Correction applied"); setCorrectField(""); setCorrectValue(""); } }
                  );
                }}>Apply Correction</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><GitMerge className="h-3 w-3 mr-1" /> Merge</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Merge Entity</DialogTitle><DialogDescription>Merge this entity into another (target).</DialogDescription></DialogHeader>
              <div><Label>Target Entity ID</Label><Input value={mergeTarget} onChange={(ev) => setMergeTarget(ev.target.value)} placeholder="target entity ID" /></div>
              <DialogFooter>
                <Button onClick={() => {
                  if (!mergeTarget) return;
                  mergeMut.mutate({ from: entityId, to: mergeTarget }, { onSuccess: () => toast.success("Merged successfully") });
                }}>Merge</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            trigger={<Button variant="outline" size="sm"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>}
            title="Delete Entity"
            description={`Soft-delete "${displayName}"? This is reversible.`}
            confirmLabel="Delete"
            variant="destructive"
            showReason
            onConfirm={(reason) =>
              deleteMut.mutate({ id: entityId, type: e.entity_type, reason }, { onSuccess: () => toast.success("Entity deleted") })
            }
          />
          <ConfirmDialog
            trigger={<Button variant="outline" size="sm"><RotateCcw className="h-3 w-3 mr-1" /> Restore</Button>}
            title="Restore Entity"
            description={`Restore "${displayName}"?`}
            confirmLabel="Restore"
            showReason
            onConfirm={(reason) =>
              restoreMut.mutate({ id: entityId, type: e.entity_type, reason }, { onSuccess: () => toast.success("Entity restored") })
            }
          />
        </div>
      }
    >
      <div className="flex items-center gap-2 mb-4">
        <TypeBadge type={e.entity_type} />
        {e.merged_to_entity_id && (
          <span className="text-sm text-muted-foreground">
            Merged to <EntityLink id={e.merged_to_entity_id} />
          </span>
        )}
      </div>

      <Tabs defaultValue="snapshot">
        <TabsList>
          <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
          <TabsTrigger value="observations">Observations ({observations.data?.observations?.length ?? "…"})</TabsTrigger>
          <TabsTrigger value="relationships">Relationships ({relationships.data?.relationships?.length ?? "…"})</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshot">
          <Card>
            <CardHeader><CardTitle className="text-base">Current Snapshot</CardTitle></CardHeader>
            <CardContent>
              {e.snapshot && typeof e.snapshot === "object" ? (
                Object.keys(e.snapshot).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(e.snapshot).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2 py-1 border-b last:border-0">
                        <button
                          className="text-xs font-mono text-purple-600 hover:underline min-w-[120px] text-left"
                          onClick={() => setProvenanceField(provenanceField === key ? undefined : key)}
                        >
                          {key}
                        </button>
                        <div className="flex-1">
                          <JsonViewer data={val} defaultExpanded={false} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Snapshot exists but has no fields yet (empty object). Check Observations or run snapshot recompute on the server if data should appear here.
                  </p>
                )
              ) : (
                <p className="text-muted-foreground text-sm">No snapshot data.</p>
              )}
              {provenanceField && (
                <Card className="mt-4 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Provenance: {provenanceField}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {provenance.isLoading ? <span className="text-sm text-muted-foreground">Loading…</span> : provenance.data ? <JsonViewer data={provenance.data} defaultExpanded /> : <span className="text-sm text-muted-foreground">No provenance data.</span>}
                  </CardContent>
                </Card>
              )}
              {e.raw_fragments && Object.keys(e.raw_fragments).length > 0 && (
                <Card className="mt-4">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Raw Fragments</CardTitle></CardHeader>
                  <CardContent><JsonViewer data={e.raw_fragments} /></CardContent>
                </Card>
              )}
              {e.provenance && Object.keys(e.provenance).length > 0 && (
                <Card className="mt-4">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Provenance</CardTitle></CardHeader>
                  <CardContent><JsonViewer data={e.provenance} /></CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="observations">
          {observations.isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <DataTable columns={obsColumns} data={observations.data?.observations ?? []} />
          )}
        </TabsContent>

        <TabsContent value="relationships">
          {relationships.isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <DataTable columns={relColumns} data={relationships.data?.relationships ?? []} />
          )}
        </TabsContent>

        <TabsContent value="graph">
          <Card>
            <CardHeader><CardTitle className="text-base">Graph Neighborhood</CardTitle></CardHeader>
            <CardContent>
              {graph.isLoading ? (
                <div className="text-muted-foreground">Loading graph…</div>
              ) : graph.data ? (
                <JsonViewer data={graph.data} defaultExpanded />
              ) : (
                <p className="text-muted-foreground text-sm">No graph data available.</p>
              )}
              <div className="mt-3">
                <Link to={`/graph?node=${encodeURIComponent(entityId)}`}>
                  <Button variant="outline" size="sm">Open in Graph Explorer</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
