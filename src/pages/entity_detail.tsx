import { useParams, Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  useEntityById,
  useEntityObservations,
  useEntityRelationships,
} from "@/hooks/use_entities";
import { useSchemaByType } from "@/hooks/use_schemas";
import { useGraphNeighborhood } from "@/hooks/use_graph";
import {
  useDeleteEntity,
  useRestoreEntity,
  useMergeEntities,
} from "@/hooks/use_mutations";
import { useBatchCorrect, useEntityMarkdown } from "@/hooks/use_entity_markdown";
import { getSourceById } from "@/api/endpoints/sources";
import { PageShell } from "@/components/layout/page_shell";
import {
  DetailPageSkeleton,
  GraphAreaSkeleton,
  ListSkeleton,
  QueryErrorAlert,
  InlineSkeleton,
} from "@/components/shared/query_status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm_dialog";
import { EntityLink } from "@/components/shared/entity_link";
import { JsonViewer } from "@/components/shared/json_viewer";
import { AttributionCard } from "@/components/shared/attribution_card";
import {
  EntityOverviewCard,
  EntityOverviewStatsRow,
  MergedIntoPill,
} from "@/components/shared/entity_overview_card";
import { SnapshotFieldList } from "@/components/shared/snapshot_field_list";
import { ObservationTimeline } from "@/components/shared/observation_timeline";
import { RelationshipPanel } from "@/components/shared/relationship_panel";
import { CopyIdButton } from "@/components/shared/copy_id_button";
import { FieldValue } from "@/components/shared/field_value";
import { entityDisplayHeadline, humanizeEntityType, humanizeKey, shortId, truncate } from "@/lib/humanize";
import { toast } from "sonner";
import { Trash2, RotateCcw, GitMerge, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Source } from "@/types/api";

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();

  const entity = useEntityById(id);
  const observations = useEntityObservations(id);
  const relationships = useEntityRelationships(id, { expand_entities: true });

  const e = entity.data;
  const schemaQuery = useSchemaByType(e?.entity_type);
  const schema = schemaQuery.data ?? null;

  const graph = useGraphNeighborhood(
    id
      ? {
          node_id: id,
          include_relationships: true,
          include_sources: true,
          include_events: true,
        }
      : null,
  );

  const deleteMut = useDeleteEntity();
  const restoreMut = useRestoreEntity();
  const mergeMut = useMergeEntities();

  const [mergeTarget, setMergeTarget] = useState("");

  const entityIdForEdit = e?.entity_id ?? e?.id ?? id ?? "";
  const markdownQuery = useEntityMarkdown(entityIdForEdit);
  const batchCorrectMut = useBatchCorrect(entityIdForEdit);
  const initialSnapshot = useMemo(
    () =>
      e?.snapshot && typeof e.snapshot === "object"
        ? (e.snapshot as Record<string, unknown>)
        : {},
    [e?.snapshot],
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [expectedLastObservationAt, setExpectedLastObservationAt] = useState<string | null>(null);
  useEffect(() => {
    if (!e) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(initialSnapshot)) {
      next[k] = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
    }
    setDraft(next);
    setExpectedLastObservationAt(e.last_observation_at ?? null);
  }, [e, initialSnapshot]);

  const relatedSourceIds = useMemo(
    () =>
      Array.from(
        new Set(
          (observations.data?.observations ?? [])
            .map((observation) => observation.source_id)
            .filter((sourceId): sourceId is string => typeof sourceId === "string" && sourceId.trim().length > 0),
        ),
      ),
    [observations.data?.observations],
  );

  const latestObservationProvenance = useMemo<Record<string, unknown> | null>(
    () => {
      const obs = observations.data?.observations ?? [];
      for (const observation of obs) {
        const prov = observation.provenance;
        if (prov && typeof prov === "object") {
          return prov as Record<string, unknown>;
        }
      }
      return null;
    },
    [observations.data?.observations],
  );
  const relatedSourceQueries = useQueries({
    queries: relatedSourceIds.map((sourceId) => ({
      queryKey: ["source", sourceId],
      queryFn: () => getSourceById(sourceId),
    })),
  });
  const relatedSources = relatedSourceQueries
    .map((query) => query.data)
    .filter((source): source is Source => Boolean(source));
  const relatedSourcesError = relatedSourceQueries.find((query) => query.error)?.error as Error | undefined;
  const relatedSourcesLoading =
    relatedSourceIds.length > 0 &&
    relatedSources.length === 0 &&
    relatedSourceQueries.some((query) => query.isLoading);

  function parseDraftValue(raw: string, previous: unknown): unknown {
    if (typeof previous === "string" || previous === null || previous === undefined) {
      return raw;
    }
    if (typeof previous === "boolean") {
      if (raw === "true") return true;
      if (raw === "false") return false;
      return raw;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  function handleSaveEdit(overwrite = false) {
    if (!e) return;
    const changes: Array<{ field: string; value: unknown }> = [];
    for (const [field, raw] of Object.entries(draft)) {
      const next = parseDraftValue(raw, initialSnapshot[field]);
      const prev = initialSnapshot[field];
      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        changes.push({ field, value: next });
      }
    }
    if (changes.length === 0) {
      toast.info("No changes to save");
      return;
    }
    batchCorrectMut.mutate(
      {
        changes,
        expected_last_observation_at: expectedLastObservationAt,
        overwrite,
        idempotency_prefix: `edit-${entityIdForEdit}-${Date.now()}`,
      },
      {
        onSuccess: (res) => {
          if (res.status === "conflict") {
            toast.warning(
              `Entity changed while you were editing. Choose Overwrite to apply anyway.`,
              { duration: 8000 },
            );
          } else if (res.status === "validation_error") {
            const msg = (res.validation_errors ?? [])
              .map((v) => `${v.field}: ${v.message}`)
              .join("; ");
            toast.error(`Validation failed: ${msg}`);
          } else {
            toast.success(`Applied ${res.applied.length} correction(s)`);
            if (res.last_observation_at) {
              setExpectedLastObservationAt(res.last_observation_at);
            }
          }
        },
        onError: (err) => toast.error(`Batch correction failed: ${err.message}`),
      },
    );
  }

  if (entity.isLoading) {
    return (
      <PageShell title="Loading…">
        <DetailPageSkeleton />
      </PageShell>
    );
  }
  if (entity.error) {
    return (
      <PageShell title="Error">
        <div className="p-6">
          <QueryErrorAlert title="Could not load entity">{entity.error.message}</QueryErrorAlert>
        </div>
      </PageShell>
    );
  }
  if (!e) {
    return (
      <PageShell title="Not Found">
        <div className="text-muted-foreground p-6">Entity not found.</div>
      </PageShell>
    );
  }

  const entityId = e.entity_id ?? e.id ?? id ?? "";
  const snapshot = (e.snapshot && typeof e.snapshot === "object"
    ? (e.snapshot as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const displayName = entityDisplayHeadline({
    canonical_name: e.canonical_name,
    snapshot,
    entity_type: e.entity_type,
    entity_type_label: e.entity_type_label ?? undefined,
    entity_id: entityId,
    id: e.id,
  });
  const schemaLabel =
    e.entity_type_label ||
    (schema?.metadata && typeof schema.metadata === "object"
      ? ((schema.metadata as Record<string, unknown>).label as string | undefined)
      : undefined);
  const humanType = humanizeEntityType(e.entity_type, schemaLabel);

  const observationCount =
    observations.data?.observations?.length ?? e.observation_count ?? 0;
  const relationshipCount = relationships.data?.relationships?.length ?? 0;

  const createdAt = e.created_at ?? e.computed_at;
  const header = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground" title={e.entity_type}>
          {humanType}
        </span>
        <CopyIdButton id={entityId} />
      </div>
      <EntityOverviewStatsRow
        observationCount={observationCount}
        relationshipCount={relationshipCount}
        lastUpdated={e.last_observation_at}
        createdAt={createdAt}
      />
    </div>
  );

  return (
    <PageShell
      title={displayName}
      description={header}
      actions={
        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <GitMerge className="h-3 w-3 mr-1" /> Merge
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Merge Entity</DialogTitle>
                <DialogDescription>
                  Merge this entity into another (target).
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label>Target Entity ID</Label>
                <Input
                  value={mergeTarget}
                  onChange={(ev) => setMergeTarget(ev.target.value)}
                  placeholder="target entity ID"
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (!mergeTarget) return;
                    mergeMut.mutate(
                      { from: entityId, to: mergeTarget },
                      { onSuccess: () => toast.success("Merged successfully") },
                    );
                  }}
                >
                  Merge
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            }
            title="Delete Entity"
            description={`Soft-delete "${displayName}"? This is reversible.`}
            confirmLabel="Delete"
            variant="destructive"
            showReason
            onConfirm={(reason) =>
              deleteMut.mutate(
                { id: entityId, type: e.entity_type, reason },
                { onSuccess: () => toast.success("Entity deleted") },
              )
            }
          />
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <RotateCcw className="h-3 w-3 mr-1" /> Restore
              </Button>
            }
            title="Restore Entity"
            description={`Restore "${displayName}"?`}
            confirmLabel="Restore"
            showReason
            onConfirm={(reason) =>
              restoreMut.mutate(
                { id: entityId, type: e.entity_type, reason },
                { onSuccess: () => toast.success("Entity restored") },
              )
            }
          />
        </div>
      }
    >
      <EntityOverviewCard
        entity={e}
        schema={schema}
        showHeroTitle={false}
        showTypeBadge={false}
        omitPrimaryFields
        mergedInto={
          e.merged_to_entity_id ? (
            <MergedIntoPill targetId={e.merged_to_entity_id} />
          ) : undefined
        }
      >
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">All fields</h2>
          <SnapshotFieldList
            entityId={entityId}
            snapshot={snapshot}
            schema={schema}
            developerView={false}
          />
        </div>
      </EntityOverviewCard>

      <div className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Sources ({relatedSourceIds.length})</h2>
          {relatedSourcesError ? (
            <QueryErrorAlert title="Could not load sources">{relatedSourcesError.message}</QueryErrorAlert>
          ) : relatedSourcesLoading ? (
            <ListSkeleton rows={4} />
          ) : relatedSourceIds.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">No sources linked to this entity yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {relatedSources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Timeline ({observations.data?.observations?.length ?? "…"})
          </h2>
          {observations.isLoading ? (
            <ListSkeleton rows={5} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ObservationTimeline
                  observations={observations.data?.observations ?? []}
                  developerView={false}
                />
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Relationships ({relationships.data?.relationships?.length ?? "…"})
          </h2>
          {relationships.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <RelationshipPanel
                  entityId={entityId}
                  data={relationships.data}
                  developerView={false}
                />
                <div className="mt-4">
                  <Link to={`/graph?node=${encodeURIComponent(entityId)}`}>
                    <Button variant="outline" size="sm">
                      Open in graph explorer
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Advanced</h2>
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Markdown preview</CardTitle>
                <p className="text-xs text-muted-foreground">
                  What agents see via MCP <code>retrieve_entity_snapshot</code>
                  and what lands in the filesystem mirror.
                </p>
              </CardHeader>
              <CardContent>
                {markdownQuery.isLoading ? (
                  <InlineSkeleton className="h-24 w-full max-w-2xl" />
                ) : markdownQuery.error ? (
                  <QueryErrorAlert title="Could not load markdown preview">
                    {markdownQuery.error.message}
                  </QueryErrorAlert>
                ) : (
                  <pre className="max-h-[480px] overflow-auto rounded bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
                    {markdownQuery.data ?? ""}
                  </pre>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identity</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[200px_1fr]">
                  <IdentityRow label="entity_id" value={entityId} />
                  <IdentityRow label="entity_type" value={e.entity_type} />
                  <IdentityRow
                    label="schema_version"
                    value={e.schema_version ?? "—"}
                  />
                  <IdentityRow
                    label="merged_to_entity_id"
                    value={e.merged_to_entity_id ?? "—"}
                  />
                  <IdentityRow
                    label="merged_at"
                    value={e.merged_at ?? "—"}
                  />
                  <IdentityRow
                    label="last_observation_at"
                    value={e.last_observation_at ?? "—"}
                  />
                  <IdentityRow
                    label="computed_at"
                    value={e.computed_at ?? "—"}
                  />
                </dl>
              </CardContent>
            </Card>
            {e.raw_fragments && Object.keys(e.raw_fragments).length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Raw fragments</CardTitle>
                </CardHeader>
                <CardContent>
                  <JsonViewer data={e.raw_fragments} />
                </CardContent>
              </Card>
            ) : null}
            <AttributionCard
              provenance={latestObservationProvenance}
              title="Latest write attribution"
              description={
                latestObservationProvenance
                  ? "Agent identity recorded on the most recent observation for this entity."
                  : "The most recent observation does not carry agent attribution."
              }
            />
            {e.provenance && Object.keys(e.provenance).length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reducer provenance</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Field → observation_id map produced by the reducer. This
                    is <em>not</em> agent attribution; see the Latest write
                    attribution card above for the agent identity.
                  </p>
                </CardHeader>
                <CardContent>
                  <JsonViewer data={e.provenance} />
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Graph neighborhood</CardTitle>
              </CardHeader>
              <CardContent>
                {graph.isLoading ? (
                  <GraphAreaSkeleton />
                ) : graph.data ? (
                  <JsonViewer data={graph.data} defaultExpanded />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No graph data available.
                  </p>
                )}
                <div className="mt-3">
                  <Link to={`/graph?node=${encodeURIComponent(entityId)}`}>
                    <Button variant="outline" size="sm">
                      Open in graph explorer
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4 border-t pt-6">
              <h2 className="text-lg font-semibold">Correct</h2>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Correct fields</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Each saved change becomes a <code>correct()</code> observation
                    with the highest priority. Changes are applied atomically and
                    go through the same validation as the CLI{" "}
                    <code>neotoma edit</code>.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.keys(draft).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No editable fields yet. Snapshot is empty.
                      </p>
                    ) : (
                      Object.entries(draft).map(([field, value]) => (
                        <EditField
                          key={field}
                          field={field}
                          value={value}
                          previous={initialSnapshot[field]}
                          schema={schema}
                          onChange={(next) =>
                            setDraft((prev) => ({ ...prev, [field]: next }))
                          }
                        />
                      ))
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(false)}
                      disabled={batchCorrectMut.isPending}
                    >
                      {batchCorrectMut.isPending ? "Saving…" : "Save changes"}
                    </Button>
                    {batchCorrectMut.data?.status === "conflict" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleSaveEdit(true)}
                        disabled={batchCorrectMut.isPending}
                      >
                        Overwrite
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  const looksLikeEntity = typeof value === "string" && value.startsWith("ent_");
  return (
    <>
      <dt className="font-mono text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all text-sm">
        {looksLikeEntity ? (
          <EntityLink id={value} name={value} className="font-mono text-xs break-all" />
        ) : (
          value
        )}
      </dd>
    </>
  );
}

function SourceCard({ source }: { source: Source }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Link
                to={`/sources/${encodeURIComponent(source.id)}`}
                className="min-w-0 truncate text-sm font-medium text-primary hover:underline"
                title={source.id}
              >
                {sourceTitle(source)}
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{sourceDetail(source)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
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
          <span className="font-mono text-xs text-muted-foreground">{shortId(source.id, 10)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EditField({
  field,
  value,
  previous,
  schema,
  onChange,
}: {
  field: string;
  value: string;
  previous: unknown;
  schema: ReturnType<typeof useSchemaByType>["data"] | null;
  onChange: (next: string) => void;
}) {
  const fieldDef = schema?.schema_definition?.fields?.[field] as
    | { type?: string; description?: string }
    | undefined;
  const summary = schema?.field_summary?.[field] as { type?: string } | undefined;
  const type = fieldDef?.type ?? summary?.type ?? inferTypeFromValue(previous);
  const label = humanizeKey(field);
  const helper = fieldDef?.description;

  if (type === "boolean") {
    const parsed =
      value === "true" ? true : value === "false" ? false : Boolean(previous);
    return (
      <div className="grid gap-1">
        <Label htmlFor={`edit-${field}`}>{label}</Label>
        <div className="flex items-center gap-2">
          <Switch
            id={`edit-${field}`}
            checked={parsed}
            onCheckedChange={(v) => onChange(v ? "true" : "false")}
          />
          <span className="text-xs text-muted-foreground">
            Current: <FieldValue value={previous} />
          </span>
        </div>
        {helper ? (
          <p className="text-xs text-muted-foreground">{helper}</p>
        ) : null}
      </div>
    );
  }

  if (type === "date") {
    const asDate = toDateInputValue(value);
    return (
      <div className="grid gap-1">
        <Label htmlFor={`edit-${field}`}>{label}</Label>
        <Input
          id={`edit-${field}`}
          type="date"
          value={asDate}
          onChange={(ev) => onChange(ev.target.value)}
        />
        {helper ? (
          <p className="text-xs text-muted-foreground">{helper}</p>
        ) : null}
      </div>
    );
  }

  if (type === "number") {
    return (
      <div className="grid gap-1">
        <Label htmlFor={`edit-${field}`}>{label}</Label>
        <Input
          id={`edit-${field}`}
          type="number"
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
        />
        {helper ? (
          <p className="text-xs text-muted-foreground">{helper}</p>
        ) : null}
      </div>
    );
  }

  if (type === "array" || type === "object") {
    return (
      <div className="grid gap-1">
        <Label htmlFor={`edit-${field}`} className="flex items-center gap-2">
          {label}
          <span className="text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
            (advanced)
          </span>
        </Label>
        <textarea
          id={`edit-${field}`}
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm"
          placeholder={type === "array" ? "[…]" : "{…}"}
        />
        {helper ? (
          <p className="text-xs text-muted-foreground">{helper}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            JSON {type}. Invalid JSON is stored as the raw string.
          </p>
        )}
      </div>
    );
  }

  const isLong = value.length > 80 || value.includes("\n");
  return (
    <div className="grid gap-1">
      <Label htmlFor={`edit-${field}`}>{label}</Label>
      {isLong ? (
        <textarea
          id={`edit-${field}`}
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          placeholder={helper}
        />
      ) : (
        <Input
          id={`edit-${field}`}
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          placeholder={helper}
        />
      )}
      {helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

function inferTypeFromValue(v: unknown): string {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (Array.isArray(v)) return "array";
  if (v !== null && typeof v === "object") return "object";
  return "string";
}

function toDateInputValue(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sourceTitle(source: Source): string {
  if (source.original_filename?.trim()) return source.original_filename.trim();
  const inferred = firstStringValue(source.provenance, ["title", "name", "file_name", "filename"]);
  if (inferred) return inferred;
  return `Source ${shortId(source.id, 10)}`;
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
  return `${humanizeKey(type)} · ${mime}`;
}

function sourcePreviewChips(source: Source): string[] {
  const chips: string[] = [];
  if (source.source_type) chips.push(`Type: ${humanizeKey(source.source_type)}`);
  if (source.mime_type) chips.push(`MIME: ${source.mime_type}`);
  if (source.file_size) chips.push(`Size: ${(source.file_size / 1024).toFixed(1)} KB`);
  if (source.created_at) chips.push(`Created: ${source.created_at.slice(0, 10)}`);
  return chips.slice(0, 4);
}

function firstStringValue(
  record: Record<string, unknown> | undefined,
  keys: string[],
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
