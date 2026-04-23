import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isApiUrlConfigured } from "@/api/client";
import { useSourceById, useSourceRelationships } from "@/hooks/use_sources";
import { useInterpretations } from "@/hooks/use_interpretations";
import { PageShell } from "@/components/layout/page_shell";
import {
  DataTableSkeleton,
  DetailPageSkeleton,
  InlineSkeleton,
  ListSkeleton,
  QueryErrorAlert,
} from "@/components/shared/query_status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JsonViewer } from "@/components/shared/json_viewer";
import { AttributionCard } from "@/components/shared/attribution_card";
import { DataTable } from "@/components/shared/data_table";
import { EntityLink } from "@/components/shared/entity_link";
import { AgentBadge } from "@/components/shared/agent_badge";
import { useAgentAttributionFilter } from "@/components/shared/agent_filter";
import { formatDate } from "@/lib/utils";
import { getFileUrl, getSourceContentBlob, getSourceContentText, getSourceContentUrl } from "@/api/endpoints/sources";
import { PdfJsInlinePreview } from "@/components/shared/pdf_js_inline_preview";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { RelationshipSnapshot } from "@/types/api";

type PreviewKind = "text" | "image" | "audio" | "pdf" | "none";

/** Above this size, buffering the whole file in JS (Blob) is unreliable; prefer signed storage URLs for media. */
const INLINE_BLOB_MAX_BYTES = 24 * 1024 * 1024;

function fileSizeLabel(size: number | null | undefined): string {
  if (!size) return "—";
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / 1024).toFixed(1)} KB`;
}

function inferPreviewKind(mimeType?: string | null, filename?: string | null): PreviewKind {
  const mime = (mimeType || "").toLowerCase();
  const name = (filename || "").toLowerCase();

  if (mime.startsWith("text/") || mime === "application/json" || mime === "application/xml" || mime === "image/svg+xml") {
    return "text";
  }
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";

  if (/\.(txt|md|json|xml|csv|tsv|html|js|ts|tsx|jsx|css|log|yaml|yml|svg)$/i.test(name)) return "text";
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name)) return "image";
  if (/\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(name)) return "audio";
  if (/\.pdf$/i.test(name)) return "pdf";

  return "none";
}

/**
 * Local adapter returns `file://…` from /get_file_url. Media elements on http(s) pages cannot load those URLs;
 * use the authenticated HTTP content route instead (same base as the rest of the inspector API).
 */
function embeddableBinaryUrl(signedOrHttpUrl: string, sourceId: string): string {
  if (signedOrHttpUrl.startsWith("file://")) {
    return getSourceContentUrl(sourceId);
  }
  return signedOrHttpUrl;
}

function guessAudioMimeType(filename?: string | null, storedMime?: string | null): string | undefined {
  const mime = (storedMime || "").toLowerCase();
  if (mime.startsWith("audio/")) return storedMime || undefined;
  const n = (filename || "").toLowerCase();
  if (n.endsWith(".wav")) return "audio/wav";
  if (n.endsWith(".mp3")) return "audio/mpeg";
  if (n.endsWith(".m4a") || n.endsWith(".mp4")) return "audio/mp4";
  if (n.endsWith(".aac")) return "audio/aac";
  if (n.endsWith(".ogg") || n.endsWith(".oga")) return "audio/ogg";
  if (n.endsWith(".flac")) return "audio/flac";
  if (mime && mime !== "application/octet-stream") return storedMime || undefined;
  return undefined;
}

const ATTRIBUTION_KEYS = new Set([
  "agent_public_key",
  "agent_thumbprint",
  "agent_algorithm",
  "agent_sub",
  "agent_iss",
  "client_name",
  "client_version",
  "connection_id",
  "attribution_tier",
  "attributed_at",
]);

/**
 * True when a provenance blob carries keys beyond the {@link AgentAttribution}
 * block. Used to decide whether to render the raw-provenance JSON viewer
 * alongside the structured attribution card: we only want the JSON fallback
 * when the blob contains something the card is not already surfacing.
 */
function hasNonAttributionKeys(
  provenance: Record<string, unknown> | null | undefined
): boolean {
  if (!provenance) return false;
  return Object.keys(provenance).some((key) => !ATTRIBUTION_KEYS.has(key));
}

function SourceRelationshipsSection({
  query,
  columns,
}: {
  query: ReturnType<typeof useSourceRelationships>;
  columns: ColumnDef<RelationshipSnapshot, unknown>[];
}) {
  const rows = query.data?.relationships ?? [];
  const { filterRows, AgentFilterControl } = useAgentAttributionFilter(rows);
  const displayed = filterRows(rows);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Relationships</CardTitle>
        <p className="text-xs text-muted-foreground">
          Edges stamped with this source or touching entities observed from this source.
        </p>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <DataTableSkeleton rows={5} cols={4} />
        ) : query.error ? (
          <QueryErrorAlert title="Could not load relationships">
            {query.error instanceof Error ? query.error.message : String(query.error)}
          </QueryErrorAlert>
        ) : displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No relationships linked to this source.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <AgentFilterControl />
            </div>
            <DataTable columns={columns} data={displayed} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** If `raw` is a single JSON object or array, return the parsed value; otherwise null. */
function tryParseJsonDocument(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const c = trimmed[0];
  if (c !== "{" && c !== "[") return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export default function SourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const source = useSourceById(id);
  const sourceRelationships = useSourceRelationships(id);
  const interpretations = useInterpretations({ source_id: id });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const relationshipColumns = useMemo<ColumnDef<RelationshipSnapshot, unknown>[]>(
    () => [
      {
        header: "Type",
        accessorKey: "relationship_type",
        cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue() as string}</span>,
      },
      {
        header: "Source entity",
        accessorKey: "source_entity_id",
        cell: ({ row }) => {
          const r = row.original;
          const name = r.source_entity_name?.trim();
          return <EntityLink id={r.source_entity_id} name={name || undefined} />;
        },
      },
      {
        header: "Target entity",
        accessorKey: "target_entity_id",
        cell: ({ row }) => {
          const r = row.original;
          const name = r.target_entity_name?.trim();
          return <EntityLink id={r.target_entity_id} name={name || undefined} />;
        },
      },
      { header: "Observations", accessorKey: "observation_count" },
      {
        header: "Last observed",
        accessorKey: "last_observation_at",
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      {
        header: "Agent",
        id: "agent",
        cell: ({ row }) => <AgentBadge provenance={row.original.agent_attribution ?? null} />,
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => {
          const r = row.original;
          const key = r.relationship_key || `${r.relationship_type}:${r.source_entity_id}:${r.target_entity_id}`;
          return (
            <Link to={`/relationships/${encodeURIComponent(key)}`} className="text-xs text-primary hover:underline">
              Detail
            </Link>
          );
        },
      },
    ],
    [],
  );

  const s = source.data;
  const previewKind = useMemo(() => inferPreviewKind(s?.mime_type, s?.original_filename), [s?.mime_type, s?.original_filename]);
  const isLargeFile = (s?.file_size ?? 0) > INLINE_BLOB_MAX_BYTES;

  const useSignedStorageUrl =
    !!s?.storage_url &&
    (previewKind === "audio" || ((previewKind === "image" || previewKind === "pdf") && isLargeFile));

  const rawText = useQuery({
    queryKey: ["source-content-text", id],
    queryFn: () => getSourceContentText(id!),
    enabled: isApiUrlConfigured() && !!id && previewKind === "text" && !isLargeFile,
  });

  const parsedJsonContent = useMemo(() => {
    const body = rawText.data;
    if (typeof body !== "string") return null;
    return tryParseJsonDocument(body);
  }, [rawText.data]);

  const signedFileUrl = useQuery({
    queryKey: ["source-signed-file-url", s?.storage_url, previewKind],
    queryFn: () => getFileUrl(s!.storage_url!),
    enabled: isApiUrlConfigured() && !!id && useSignedStorageUrl,
  });

  const rawBlob = useQuery({
    queryKey: ["source-content-blob", id, previewKind],
    queryFn: () => getSourceContentBlob(id!),
    enabled:
      isApiUrlConfigured() &&
      !!id &&
      ((previewKind === "image" && !isLargeFile) ||
        (previewKind === "pdf" && !isLargeFile) ||
        (previewKind === "audio" && !s?.storage_url && !isLargeFile)),
  });

  useEffect(() => {
    if (!rawBlob.data) {
      setBlobUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(rawBlob.data);
    setBlobUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [rawBlob.data]);

  async function handleDownload() {
    if (!s?.storage_url) { toast.error("No storage URL"); return; }
    try {
      const { url } = await getFileUrl(s.storage_url);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(`Download failed: ${err}`);
    }
  }

  if (source.isLoading)
    return (
      <PageShell title="Loading…">
        <DetailPageSkeleton />
      </PageShell>
    );
  if (source.error)
    return (
      <PageShell title="Error">
        <QueryErrorAlert title="Could not load source">{source.error.message}</QueryErrorAlert>
      </PageShell>
    );
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
            {s.filesystem_absolute_path ? (
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <span className="text-muted-foreground shrink-0">Filesystem path</span>
                <span className="font-mono text-xs break-all text-right sm:max-w-[min(100%,520px)]">{s.filesystem_absolute_path}</span>
              </div>
            ) : null}
            <div className="flex justify-between"><span className="text-muted-foreground">Content Hash</span><span className="font-mono text-xs truncate max-w-[240px]">{s.content_hash || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">MIME Type</span><span>{s.mime_type || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Source Type</span><span>{s.source_type || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">File Size</span><span>{fileSizeLabel(s.file_size)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(s.created_at)}</span></div>
          </CardContent>
        </Card>

        <AttributionCard
          provenance={s.provenance ?? null}
          title="Agent attribution"
          description="Which agent uploaded or synthesised this source."
        />
      </div>

      <SourceRelationshipsSection query={sourceRelationships} columns={relationshipColumns} />

      {s.provenance && hasNonAttributionKeys(s.provenance) ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Raw provenance</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonViewer data={s.provenance} defaultExpanded />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Raw Content</CardTitle>
        </CardHeader>
        <CardContent>
          {previewKind === "text" ? (
            isLargeFile ? (
              <p className="text-sm text-muted-foreground">
                This file is about {fileSizeLabel(s.file_size)}. Inline text preview is disabled to avoid loading the entire body in the browser. Use
                Download to open it locally.
              </p>
            ) : rawText.isLoading ? (
              <InlineSkeleton className="h-32 w-full max-w-2xl" />
            ) : rawText.error ? (
              <QueryErrorAlert title="Could not load raw content">
                {String(rawText.error instanceof Error ? rawText.error.message : rawText.error)}
              </QueryErrorAlert>
            ) : parsedJsonContent != null ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Parsed as JSON (structured view).</p>
                <div className="max-h-[480px] overflow-auto rounded-md border bg-muted/30 p-3">
                  <JsonViewer data={parsedJsonContent} expandAll />
                </div>
              </div>
            ) : (
              <pre className="max-h-[480px] overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
                {rawText.data || "No raw text content returned."}
              </pre>
            )
          ) : previewKind === "image" ? (
            isLargeFile && !s.storage_url ? (
              <p className="text-sm text-muted-foreground">
                Inline preview is disabled for files over {fileSizeLabel(INLINE_BLOB_MAX_BYTES)} when no storage URL is available. Use Download.
              </p>
            ) : useSignedStorageUrl ? (
              signedFileUrl.isLoading ? (
                <InlineSkeleton className="h-48 w-full max-w-md" />
              ) : signedFileUrl.error ? (
                <QueryErrorAlert title="Could not resolve image URL">
                  {String(signedFileUrl.error instanceof Error ? signedFileUrl.error.message : signedFileUrl.error)}
                </QueryErrorAlert>
              ) : signedFileUrl.data?.url ? (
                <img
                  src={embeddableBinaryUrl(signedFileUrl.data.url, s.id)}
                  alt={s.original_filename || s.id}
                  className="max-h-[640px] w-full rounded-md object-contain bg-muted/30"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Image preview unavailable.</p>
              )
            ) : rawBlob.isLoading ? (
              <InlineSkeleton className="h-48 w-full max-w-md" />
            ) : rawBlob.error ? (
              <QueryErrorAlert title="Could not load image preview">
                {String(rawBlob.error instanceof Error ? rawBlob.error.message : rawBlob.error)}
              </QueryErrorAlert>
            ) : blobUrl ? (
              <img src={blobUrl} alt={s.original_filename || s.id} className="max-h-[640px] w-full rounded-md object-contain bg-muted/30" />
            ) : (
              <p className="text-sm text-muted-foreground">Image preview unavailable.</p>
            )
          ) : previewKind === "audio" ? (
            useSignedStorageUrl ? (
              signedFileUrl.isLoading ? (
                <InlineSkeleton className="h-12 w-full max-w-md" />
              ) : signedFileUrl.error ? (
                <QueryErrorAlert title="Could not resolve audio URL">
                  {String(signedFileUrl.error instanceof Error ? signedFileUrl.error.message : signedFileUrl.error)}
                </QueryErrorAlert>
              ) : signedFileUrl.data?.url ? (
                <audio
                  controls
                  preload="metadata"
                  className="w-full"
                  src={embeddableBinaryUrl(signedFileUrl.data.url, s.id)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Audio preview unavailable.</p>
              )
            ) : isLargeFile ? (
              <p className="text-sm text-muted-foreground">
                This file is about {fileSizeLabel(s.file_size)} with no direct storage path for streaming. Use Download to play it in an external
                player.
              </p>
            ) : rawBlob.isLoading ? (
              <InlineSkeleton className="h-12 w-full max-w-md" />
            ) : rawBlob.error ? (
              <QueryErrorAlert title="Could not load audio preview">
                {String(rawBlob.error instanceof Error ? rawBlob.error.message : rawBlob.error)}
              </QueryErrorAlert>
            ) : blobUrl ? (
              <audio controls preload="metadata" className="w-full">
                <source src={blobUrl} type={guessAudioMimeType(s.original_filename, s.mime_type)} />
              </audio>
            ) : (
              <p className="text-sm text-muted-foreground">Audio preview unavailable.</p>
            )
          ) : previewKind === "pdf" ? (
            isLargeFile && !s.storage_url ? (
              <p className="text-sm text-muted-foreground">
                Inline preview is disabled for files over {fileSizeLabel(INLINE_BLOB_MAX_BYTES)} when no storage URL is available. Use Download.
              </p>
            ) : useSignedStorageUrl ? (
              signedFileUrl.isLoading ? (
                <InlineSkeleton className="h-64 w-full" />
              ) : signedFileUrl.error ? (
                <QueryErrorAlert title="Could not resolve PDF URL">
                  {String(signedFileUrl.error instanceof Error ? signedFileUrl.error.message : signedFileUrl.error)}
                </QueryErrorAlert>
              ) : signedFileUrl.data?.url ? (
                <PdfJsInlinePreview documentUrl={embeddableBinaryUrl(signedFileUrl.data.url, s.id)} />
              ) : (
                <p className="text-sm text-muted-foreground">PDF preview unavailable.</p>
              )
            ) : rawBlob.isLoading ? (
              <InlineSkeleton className="h-64 w-full" />
            ) : rawBlob.error ? (
              <QueryErrorAlert title="Could not load PDF preview">
                {String(rawBlob.error instanceof Error ? rawBlob.error.message : rawBlob.error)}
              </QueryErrorAlert>
            ) : blobUrl ? (
              <PdfJsInlinePreview documentUrl={blobUrl} />
            ) : (
              <p className="text-sm text-muted-foreground">PDF preview unavailable.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Inline preview is not available for this file type. Use Download to inspect the raw bytes directly.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Interpretations</CardTitle></CardHeader>
        <CardContent>
          {interpretations.isLoading ? (
            <ListSkeleton rows={3} />
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
