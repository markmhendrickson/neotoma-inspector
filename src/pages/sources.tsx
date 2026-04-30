import { useState } from "react";
import { Link } from "react-router-dom";
import { useSources } from "@/hooks/use_sources";
import { useStore, useStoreUnstructured } from "@/hooks/use_mutations";
import { PageShell } from "@/components/layout/page_shell";
import { ListSkeleton, QueryErrorAlert } from "@/components/shared/query_status";
import { AgentBadge } from "@/components/shared/agent_badge";
import { useAgentAttributionFilter } from "@/components/shared/agent_filter";
import { OffsetPagination as Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { LiveRelativeTime } from "@/components/shared/live_relative_time";
import { showBackgroundQueryRefresh, showInitialQuerySkeleton } from "@/lib/query_loading";
import { formatDate, truncateId } from "@/lib/utils";
import { QueryRefreshIndicator } from "@/components/shared/query_refresh_indicator";
import { toast } from "sonner";
import { Plus, Upload, Search } from "lucide-react";
import type { Source } from "@/types/api";

const PAGE_SIZE = 25;

type MimePreset = "all" | "audio" | "image" | "pdf" | "text" | "video" | "custom";

const MIME_PRESET_FILTERS: { id: Exclude<MimePreset, "all" | "custom">; label: string; needle: string }[] = [
  { id: "audio", label: "Audio", needle: "audio" },
  { id: "image", label: "Image", needle: "image" },
  { id: "pdf", label: "PDF", needle: "pdf" },
  { id: "text", label: "Text", needle: "text" },
  { id: "video", label: "Video", needle: "video" },
];

export default function SourcesPage() {
  const [search, setSearch] = useState("");
  const [mimePreset, setMimePreset] = useState<MimePreset>("all");
  const [mimeCustom, setMimeCustom] = useState("");
  const [offset, setOffset] = useState(0);

  const mimeTypeForApi =
    mimePreset === "all"
      ? undefined
      : mimePreset === "custom"
        ? mimeCustom.trim() || undefined
        : MIME_PRESET_FILTERS.find((p) => p.id === mimePreset)?.needle;

  const sources = useSources({
    search: search || undefined,
    mime_type: mimeTypeForApi,
    limit: PAGE_SIZE,
    offset,
  });
  const sourcesList = sources.data?.sources ?? [];
  const { filterRows, AgentFilterControl } =
    useAgentAttributionFilter(sourcesList);
  const displayedSources = filterRows(sourcesList);

  function setMimePresetAndReset(preset: MimePreset) {
    setMimePreset(preset);
    if (preset !== "custom") setMimeCustom("");
    setOffset(0);
  }

  const [storeJson, setStoreJson] = useState('{\n  "entities": [],\n  "idempotency_key": ""\n}');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const storeMut = useStore();
  const uploadMut = useStoreUnstructured();

  return (
    <PageShell
      title="Sources"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {showBackgroundQueryRefresh(sources) ? <QueryRefreshIndicator /> : null}
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search sources…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="pl-9"
            />
          </div>
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5 sm:flex-[0_1_auto]">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={mimePreset === "all" ? "secondary" : "outline"}
                className="h-8 shrink-0 px-2.5 text-xs"
                onClick={() => setMimePresetAndReset("all")}
              >
                All
              </Button>
              {MIME_PRESET_FILTERS.map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={mimePreset === id ? "secondary" : "outline"}
                  className="h-8 shrink-0 px-2.5 text-xs"
                  onClick={() => setMimePresetAndReset(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex w-full min-w-[140px] flex-col gap-1.5 sm:w-[200px]">
            <span className="text-xs font-medium text-muted-foreground">Custom MIME</span>
            <Input
              placeholder="e.g. wav, octet-stream"
              value={mimeCustom}
              onChange={(e) => {
                setMimeCustom(e.target.value);
                setMimePreset("custom");
                setOffset(0);
              }}
              className="h-8"
            />
          </div>
          <AgentFilterControl />
        </div>
      </div>

      {showInitialQuerySkeleton(sources) ? (
        <ListSkeleton rows={10} />
      ) : sources.error ? (
        <QueryErrorAlert title="Could not load sources">{sources.error.message}</QueryErrorAlert>
      ) : (
        <>
          <div className="space-y-2">
            {displayedSources.map((source) => (
              <div key={source.id} className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <LiveRelativeTime
                    iso={source.created_at}
                    className="inline-block w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/sources/${encodeURIComponent(source.id)}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {sourceTitle(source)}
                      </Link>
                      <AgentBadge
                        provenance={source.provenance ?? null}
                        iconOnly
                      />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {sourceDetail(source)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {sourcePreviewChips(source).map((chip) => (
                        <span
                          key={`${source.id}-${chip}`}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sources.data && sources.data.sources.length >= PAGE_SIZE && (
            <Pagination offset={offset} limit={PAGE_SIZE} total={sources.data.sources.length + offset + 1} onPageChange={setOffset} />
          )}
        </>
      )}
    </PageShell>
  );
}

function sourceTitle(source: Source): string {
  if (source.original_filename?.trim()) return source.original_filename.trim();
  const inferred = firstStringValue(source.provenance, ["title", "name", "file_name", "filename"]);
  if (inferred) return inferred;
  return `Source ${truncateId(source.id, 10)}`;
}

function sourceDetail(source: Source): string {
  const summary = firstStringValue(source.provenance, [
    "summary",
    "description",
    "content",
    "conversation_title",
    "prompt",
  ]);
  if (summary) return truncate(summary, 140);

  const type = source.source_type || "source";
  const mime = source.mime_type || "unknown format";
  return `${humanize(type)} · ${mime}`;
}

function sourcePreviewChips(source: Source): string[] {
  const chips: string[] = [];

  if (source.source_type) chips.push(`Type: ${humanize(source.source_type)}`);
  if (source.mime_type) chips.push(`MIME: ${source.mime_type}`);
  if (source.file_size) chips.push(`Size: ${(source.file_size / 1024).toFixed(1)} KB`);
  if (source.created_at) chips.push(`Created: ${formatDate(source.created_at)}`);
  if (source.content_hash) chips.push(`Hash: ${truncateId(source.content_hash, 12)}`);

  return chips.slice(0, 5);
}

function firstStringValue(
  record: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const compact = value.replace(/\s+/g, " ").trim();
      if (compact) return compact;
    }
  }
  return undefined;
}

function humanize(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/, (c) => c.toUpperCase())
    .replace(/\s{2,}/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

