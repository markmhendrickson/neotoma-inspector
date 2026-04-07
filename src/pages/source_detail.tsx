import { useParams } from "react-router-dom";
import { useSourceById } from "@/hooks/use_sources";
import { useInterpretations } from "@/hooks/use_interpretations";
import { PageShell } from "@/components/layout/page_shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JsonViewer } from "@/components/shared/json_viewer";
import { formatDate } from "@/lib/utils";
import { getFileUrl } from "@/api/endpoints/sources";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function SourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const source = useSourceById(id);
  const interpretations = useInterpretations({ source_id: id });

  const s = source.data;

  async function handleDownload() {
    if (!s?.storage_url) { toast.error("No storage URL"); return; }
    try {
      const { url } = await getFileUrl(s.storage_url);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(`Download failed: ${err}`);
    }
  }

  if (source.isLoading) return <PageShell title="Loading…"><div className="text-muted-foreground">Loading source…</div></PageShell>;
  if (!s) return <PageShell title="Not Found"><div className="text-muted-foreground">Source not found.</div></PageShell>;

  return (
    <PageShell
      title={s.original_filename || s.id}
      description={`Source · ${s.mime_type || "unknown"}`}
      actions={
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-3 w-3 mr-1" /> Download
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono text-xs">{s.id}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Content Hash</span><span className="font-mono text-xs truncate max-w-[240px]">{s.content_hash || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">MIME Type</span><span>{s.mime_type || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Source Type</span><span>{s.source_type || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">File Size</span><span>{s.file_size ? `${(s.file_size / 1024).toFixed(1)} KB` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(s.created_at)}</span></div>
          </CardContent>
        </Card>

        {s.provenance && (
          <Card>
            <CardHeader><CardTitle className="text-base">Provenance</CardTitle></CardHeader>
            <CardContent><JsonViewer data={s.provenance} defaultExpanded /></CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Interpretations</CardTitle></CardHeader>
        <CardContent>
          {interpretations.isLoading ? (
            <span className="text-muted-foreground text-sm">Loading…</span>
          ) : interpretations.data?.interpretations?.length ? (
            <div className="space-y-2">
              {interpretations.data.interpretations.map((interp) => (
                <div key={interp.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div>
                    <span className="font-medium">{interp.status || "unknown"}</span>
                    <span className="ml-2 text-muted-foreground">Observations: {interp.observations_created ?? "—"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(interp.completed_at || interp.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No interpretations found.</p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
