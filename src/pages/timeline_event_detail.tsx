import { useParams } from "react-router-dom";
import { useTimelineEvent } from "@/hooks/use_timeline";
import { PageShell } from "@/components/layout/page_shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/shared/entity_link";
import { SourceLink } from "@/components/shared/source_link";
import { JsonViewer } from "@/components/shared/json_viewer";
import { formatDate } from "@/lib/utils";

export default function TimelineEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const event = useTimelineEvent(id);

  const ev = event.data?.event;

  if (event.isLoading) return <PageShell title="Loading…"><div className="text-muted-foreground">Loading…</div></PageShell>;
  if (!ev) return <PageShell title="Not Found"><div className="text-muted-foreground">Event not found.</div></PageShell>;

  return (
    <PageShell title={ev.event_type || "Event"} description={`Timeline Event · ${formatDate(ev.event_timestamp)}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono text-xs">{ev.id}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{ev.event_type || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Event date</span><span>{formatDate(ev.event_timestamp)}</span></div>
            {ev.created_at && (
              <div className="flex justify-between"><span className="text-muted-foreground">Indexed at</span><span>{formatDate(ev.created_at)}</span></div>
            )}
            {ev.source_id && (
              <div className="flex justify-between"><span className="text-muted-foreground">Source</span><SourceLink id={ev.source_id} /></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Linked Entities</CardTitle></CardHeader>
          <CardContent>
            {(ev.entity_id || ev.entity_ids?.length) ? (
              <div className="space-y-1">
                {(ev.entity_id ? [ev.entity_id] : ev.entity_ids ?? []).map((eid) => (
                  <div key={eid}><EntityLink id={eid} /></div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No linked entities.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {ev.properties && Object.keys(ev.properties).length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Properties</CardTitle></CardHeader>
          <CardContent><JsonViewer data={ev.properties} defaultExpanded /></CardContent>
        </Card>
      )}
    </PageShell>
  );
}
