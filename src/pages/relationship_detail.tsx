import { useParams } from "react-router-dom";
import { useRelationshipSnapshot } from "@/hooks/use_relationships";
import { useDeleteRelationship, useRestoreRelationship } from "@/hooks/use_mutations";
import { PageShell } from "@/components/layout/page_shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm_dialog";
import { EntityLink } from "@/components/shared/entity_link";
import { JsonViewer } from "@/components/shared/json_viewer";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, RotateCcw } from "lucide-react";

export default function RelationshipDetailPage() {
  const { key } = useParams<{ key: string }>();
  const parts = key?.split(":") ?? [];
  const [relType, sourceId, targetId] = parts.length >= 3 ? [parts[0]!, parts[1]!, parts.slice(2).join(":")] : [undefined, undefined, undefined];

  const snapshot = useRelationshipSnapshot(relType, sourceId, targetId);
  const deleteMut = useDeleteRelationship();
  const restoreMut = useRestoreRelationship();

  const s = snapshot.data?.snapshot;

  if (snapshot.isLoading) return <PageShell title="Loading…"><div className="text-muted-foreground">Loading…</div></PageShell>;
  if (!s) return <PageShell title="Not Found"><div className="text-muted-foreground">Relationship not found.</div></PageShell>;

  return (
    <PageShell
      title={`${s.relationship_type}`}
      description={`${s.source_entity_id} → ${s.target_entity_id}`}
      actions={
        <div className="flex gap-2">
          <ConfirmDialog
            trigger={<Button variant="outline" size="sm"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>}
            title="Delete Relationship"
            description="Soft-delete this relationship? This is reversible."
            confirmLabel="Delete"
            variant="destructive"
            showReason
            onConfirm={(reason) =>
              deleteMut.mutate(
                { type: s.relationship_type, source: s.source_entity_id, target: s.target_entity_id, reason },
                { onSuccess: () => toast.success("Relationship deleted") }
              )
            }
          />
          <ConfirmDialog
            trigger={<Button variant="outline" size="sm"><RotateCcw className="h-3 w-3 mr-1" /> Restore</Button>}
            title="Restore Relationship"
            description="Restore this relationship?"
            confirmLabel="Restore"
            showReason
            onConfirm={(reason) =>
              restoreMut.mutate(
                { type: s.relationship_type, source: s.source_entity_id, target: s.target_entity_id, reason },
                { onSuccess: () => toast.success("Relationship restored") }
              )
            }
          />
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-mono">{s.relationship_type}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Source</span><EntityLink id={s.source_entity_id} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Target</span><EntityLink id={s.target_entity_id} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Observations</span><span>{s.observation_count}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Computed</span><span>{formatDate(s.computed_at)}</span></div>
          </CardContent>
        </Card>

        {s.snapshot && (
          <Card>
            <CardHeader><CardTitle className="text-base">Snapshot</CardTitle></CardHeader>
            <CardContent><JsonViewer data={s.snapshot} defaultExpanded /></CardContent>
          </Card>
        )}
      </div>

      {snapshot.data?.observations && snapshot.data.observations.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Contributing Observations</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snapshot.data.observations.map((obs, i) => (
                <div key={i} className="rounded-md border p-3">
                  <JsonViewer data={obs} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {s.provenance && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Provenance</CardTitle></CardHeader>
          <CardContent><JsonViewer data={s.provenance} defaultExpanded /></CardContent>
        </Card>
      )}
    </PageShell>
  );
}
