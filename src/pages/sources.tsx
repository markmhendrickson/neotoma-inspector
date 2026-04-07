import { useState } from "react";
import { Link } from "react-router-dom";
import { useSources } from "@/hooks/use_sources";
import { useStore, useStoreUnstructured } from "@/hooks/use_mutations";
import { PageShell } from "@/components/layout/page_shell";
import { DataTable } from "@/components/shared/data_table";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatDate, truncateId } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Upload, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Source } from "@/types/api";

const PAGE_SIZE = 25;

export default function SourcesPage() {
  const [search, setSearch] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [offset, setOffset] = useState(0);

  const sources = useSources({ search: search || undefined, mime_type: mimeType || undefined, limit: PAGE_SIZE, offset });

  const [storeJson, setStoreJson] = useState('{\n  "entities": [],\n  "idempotency_key": ""\n}');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const storeMut = useStore();
  const uploadMut = useStoreUnstructured();

  const columns: ColumnDef<Source, unknown>[] = [
    {
      header: "Filename",
      accessorKey: "original_filename",
      cell: ({ row }) => (
        <Link to={`/sources/${encodeURIComponent(row.original.id)}`} className="font-medium text-primary hover:underline">
          {row.original.original_filename || truncateId(row.original.id)}
        </Link>
      ),
    },
    { header: "MIME", accessorKey: "mime_type", cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || "—"}</span> },
    { header: "Type", accessorKey: "source_type" },
    { header: "Size", accessorKey: "file_size", cell: ({ getValue }) => { const v = getValue() as number | undefined; return v ? `${(v / 1024).toFixed(1)} KB` : "—"; } },
    { header: "Created", accessorKey: "created_at", cell: ({ getValue }) => formatDate(getValue() as string) },
    { header: "ID", accessorKey: "id", cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{truncateId(getValue() as string, 12)}</span> },
  ];

  return (
    <PageShell
      title="Sources"
      actions={
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Store</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Store (Structured)</DialogTitle><DialogDescription>Submit a structured store request with entities and relationships.</DialogDescription></DialogHeader>
              <div><Label>Request JSON</Label><Textarea value={storeJson} onChange={(e) => setStoreJson(e.target.value)} rows={12} className="font-mono text-xs" /></div>
              <DialogFooter>
                <Button onClick={() => {
                  try {
                    storeMut.mutate(JSON.parse(storeJson), { onSuccess: () => toast.success("Stored successfully") });
                  } catch { toast.error("Invalid JSON"); }
                }}>Store</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" /> Upload</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload File</DialogTitle><DialogDescription>Upload a raw file for unstructured storage.</DialogDescription></DialogHeader>
              <div>
                <Label>File</Label>
                <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
              </div>
              <DialogFooter>
                <Button disabled={!uploadFile} onClick={async () => {
                  if (!uploadFile) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = (reader.result as string).split(",")[1]!;
                    uploadMut.mutate(
                      { file_content: base64, mime_type: uploadFile.type || "application/octet-stream", original_filename: uploadFile.name },
                      { onSuccess: () => { toast.success("File uploaded"); setUploadFile(null); } }
                    );
                  };
                  reader.readAsDataURL(uploadFile);
                }}>Upload</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search sources…" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} className="pl-9" />
        </div>
        <Input placeholder="MIME type…" value={mimeType} onChange={(e) => { setMimeType(e.target.value); setOffset(0); }} className="w-[180px]" />
      </div>

      {sources.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : sources.error ? (
        <div className="text-destructive">Error: {sources.error.message}</div>
      ) : (
        <>
          <DataTable columns={columns} data={sources.data?.sources ?? []} />
          {sources.data && sources.data.sources.length >= PAGE_SIZE && (
            <Pagination offset={offset} limit={PAGE_SIZE} total={sources.data.sources.length + offset + 1} onPageChange={setOffset} />
          )}
        </>
      )}
    </PageShell>
  );
}
