import { useState } from "react";
import { Link } from "react-router-dom";
import { useTimeline } from "@/hooks/use_timeline";
import { PageShell } from "@/components/layout/page_shell";
import { DataTable } from "@/components/shared/data_table";
import { EntityLink } from "@/components/shared/entity_link";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { TimelineEvent } from "@/types/api";

const PAGE_SIZE = 25;

export default function TimelinePage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventType, setEventType] = useState("");
  const [offset, setOffset] = useState(0);

  const timeline = useTimeline({
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    event_type: eventType || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const columns: ColumnDef<TimelineEvent, unknown>[] = [
    {
      header: "Event Type",
      accessorKey: "event_type",
      cell: ({ row }) => (
        <Link to={`/timeline/${encodeURIComponent(row.original.id)}`} className="font-medium text-primary hover:underline">
          {row.original.event_type || "event"}
        </Link>
      ),
    },
    {
      header: "Timestamp",
      accessorKey: "event_timestamp",
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      header: "Entities",
      id: "entities",
      cell: ({ row }) => {
        const ev = row.original;
        const ids = ev.entity_id ? [ev.entity_id] : ev.entity_ids ?? [];
        if (!ids.length) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {ids.slice(0, 3).map((eid) => <EntityLink key={eid} id={eid} />)}
            {ids.length > 3 && <span className="text-xs text-muted-foreground">+{ids.length - 3}</span>}
          </div>
        );
      },
    },
    {
      header: "Properties",
      id: "prop_count",
      cell: ({ row }) => {
        const props = row.original.properties;
        return props ? `${Object.keys(props).length} props` : "—";
      },
    },
  ];

  return (
    <PageShell title="Timeline" description="Chronological event stream">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setOffset(0); }} className="w-[160px]" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">End Date</label>
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setOffset(0); }} className="w-[160px]" />
        </div>
        <Input placeholder="Event type…" value={eventType} onChange={(e) => { setEventType(e.target.value); setOffset(0); }} className="w-[160px]" />
      </div>

      {timeline.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : timeline.error ? (
        <div className="text-destructive">Error: {timeline.error.message}</div>
      ) : (
        <>
          <DataTable columns={columns} data={timeline.data?.events ?? []} />
          {timeline.data && timeline.data.events.length >= PAGE_SIZE && (
            <Pagination offset={offset} limit={PAGE_SIZE} total={timeline.data.events.length + offset + 1} onPageChange={setOffset} />
          )}
        </>
      )}
    </PageShell>
  );
}
