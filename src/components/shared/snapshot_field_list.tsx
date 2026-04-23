import { useState } from "react";
import { Link } from "react-router-dom";
import { FieldValue } from "@/components/shared/field_value";
import { InlineSkeleton } from "@/components/shared/query_status";
import { JsonViewer } from "@/components/shared/json_viewer";
import { AgentBadge } from "@/components/shared/agent_badge";
import { useFieldProvenance } from "@/hooks/use_entities";
import { humanizeKey, shortId } from "@/lib/humanize";
import { orderedSnapshotKeys } from "@/lib/snapshot_ordering";
import type { EntitySchema, Observation, Source } from "@/types/api";
import { Info } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface SnapshotFieldListProps {
  entityId: string;
  snapshot: Record<string, unknown>;
  schema?: EntitySchema | null;
  /**
   * When true, show developer details (raw keys, provenance panel by default,
   * schema/content hashes). In friendly mode a small "Sources" chip reveals
   * provenance inline.
   */
  developerView?: boolean;
}

export function SnapshotFieldList({
  entityId,
  snapshot,
  schema,
  developerView,
}: SnapshotFieldListProps) {
  const schemaFieldOrder: string[] = schema?.schema_definition?.fields
    ? Object.keys(schema.schema_definition.fields)
    : schema?.field_names ?? [];
  const keys = orderedSnapshotKeys(snapshot, schemaFieldOrder);

  if (keys.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Snapshot exists but has no fields yet. Check Timeline or run a snapshot
        recompute on the server if data should appear here.
      </p>
    );
  }

  return (
    <dl className="divide-y">
      {keys.map((key) => (
        <FieldRow
          key={key}
          entityId={entityId}
          fieldKey={key}
          value={snapshot[key]}
          schema={schema}
          developerView={developerView}
        />
      ))}
    </dl>
  );
}

function FieldRow({
  entityId,
  fieldKey,
  value,
  schema,
  developerView,
}: {
  entityId: string;
  fieldKey: string;
  value: unknown;
  schema?: EntitySchema | null;
  developerView?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const provenance = useFieldProvenance(open ? entityId : undefined, open ? fieldKey : undefined);

  const fieldDef = schema?.schema_definition?.fields?.[fieldKey] as
    | { type?: string; description?: string }
    | undefined;
  const fieldSummary = schema?.field_summary?.[fieldKey] as { type?: string } | undefined;
  const typeHint = fieldDef?.type ?? fieldSummary?.type;

  const label = developerView ? fieldKey : humanizeKey(fieldKey);
  const labelClassName = developerView
    ? "font-mono text-xs text-purple-700"
    : "text-xs uppercase tracking-wide text-muted-foreground";

  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr] sm:items-start">
      <dt className="min-w-0">
        <div className={cn("break-words", labelClassName)}>{label}</div>
        {fieldDef?.description && !developerView ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{fieldDef.description}</div>
        ) : null}
      </dt>
      <dd className="min-w-0 space-y-1">
        <FieldValue value={value} typeHint={typeHint} />
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            title="Show provenance chain for this field"
          >
            <Info className="h-3 w-3" />
            {open ? "Hide sources" : "Sources"}
          </button>
        </div>
        {open ? (
          <div className="rounded border border-dashed bg-muted/30 p-2">
            {provenance.isLoading ? (
              <InlineSkeleton className="h-3 w-40" />
            ) : provenance.data ? (
              <FieldProvenanceSummary data={provenance.data} developerView={developerView} />
            ) : (
              <span className="text-xs text-muted-foreground">No provenance data.</span>
            )}
          </div>
        ) : null}
      </dd>
    </div>
  );
}

interface FieldProvenanceData {
  field?: string;
  entity_id?: string;
  observation_ids?: string[];
  observations?: Observation[];
  sources?: Source[];
}

/**
 * Human-readable summary of a field's provenance chain: which agent(s)
 * wrote it, from which source(s), and when. Falls back to the raw JSON in
 * developer view so we don't lose anything the backend returned.
 */
function FieldProvenanceSummary({
  data,
  developerView,
}: {
  data: unknown;
  developerView?: boolean;
}) {
  const payload = (data ?? {}) as FieldProvenanceData;
  const observations = payload.observations ?? [];
  const sourcesById = new Map(
    (payload.sources ?? []).map((s) => [s.id, s] as const)
  );

  if (observations.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        No contributing observations found for this field.
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Contributing observations ({observations.length})
      </p>
      <ul className="space-y-1.5">
        {observations.map((obs) => {
          const source = obs.source_id ? sourcesById.get(obs.source_id) : undefined;
          return (
            <li
              key={obs.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
            >
              <AgentBadge provenance={obs.provenance ?? null} />
              {obs.observed_at ? (
                <span className="text-muted-foreground">
                  {formatDate(obs.observed_at)}
                </span>
              ) : null}
              {obs.source_id ? (
                <Link
                  to={`/sources/${encodeURIComponent(obs.source_id)}`}
                  className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] hover:bg-muted/70"
                  title={obs.source_id}
                >
                  {source?.original_filename
                    ? source.original_filename
                    : `source ${shortId(obs.source_id, 8)}`}
                </Link>
              ) : null}
              <span className="font-mono text-[10px] text-muted-foreground break-all">
                obs {shortId(obs.id, 8)}
              </span>
            </li>
          );
        })}
      </ul>
      {developerView ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">
            Raw provenance payload
          </summary>
          <div className="mt-1">
            <JsonViewer data={data} defaultExpanded />
          </div>
        </details>
      ) : null}
    </div>
  );
}
