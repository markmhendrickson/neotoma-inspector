import { useState } from "react";
import { useInterpretations } from "@/hooks/use_interpretations";
import { PageShell } from "@/components/layout/page_shell";
import { DataTable } from "@/components/shared/data_table";
import { SourceLink } from "@/components/shared/source_link";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { Interpretation } from "@/types/api";

const PAGE_SIZE = 25;

export default function InterpretationsPage() {
  const [sourceId, setSourceId] = useState("");
  const [offset, setOffset] = useState(0);

  const interps = useInterpretations({ source_id: sourceId || undefined, limit: PAGE_SIZE, offset });

  const columns: ColumnDef<Interpretation, unknown>[] = [
    {
      header: "Source",
      accessorKey: "source_id",
      cell: ({ getValue }) => <SourceLink id={getValue() as string} />,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => {
        const status = getValue() as string | undefined;
        const variant = status === "completed" ? "default" : status === "failed" ? "destructive" : "secondary";
        return <Badge variant={variant}>{status || "unknown"}</Badge>;
      },
    },
    { header: "Observations Created", accessorKey: "observations_created" },
    { header: "Created", accessorKey: "created_at", cell: ({ getValue }) => formatDate(getValue() as string) },
    { header: "Completed", accessorKey: "completed_at", cell: ({ getValue }) => formatDate(getValue() as string) },
  ];

  return (
    <PageShell title="Interpretations" description="AI interpretation runs on sources">
      <div className="flex flex-wrap items-end gap-3">
        <Input placeholder="Filter by source ID…" value={sourceId} onChange={(e) => { setSourceId(e.target.value); setOffset(0); }} className="w-[250px]" />
      </div>

      {interps.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : interps.error ? (
        <div className="text-destructive">Error: {interps.error.message}</div>
      ) : (
        <>
          <DataTable columns={columns} data={interps.data?.interpretations ?? []} />
          {interps.data && interps.data.interpretations.length >= PAGE_SIZE && (
            <Pagination offset={offset} limit={PAGE_SIZE} total={interps.data.interpretations.length + offset + 1} onPageChange={setOffset} />
          )}
        </>
      )}
    </PageShell>
  );
}
